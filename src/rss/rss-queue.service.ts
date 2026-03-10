import { EntityManager } from '@mikro-orm/core';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue, Worker } from 'bullmq';
import { load } from 'cheerio';
import Parser from 'rss-parser';
import sanitizeHtml from 'sanitize-html';
import { RssArticle } from '../database/entities/rss-article.entity';
import { RssFeed } from '../database/entities/rss-feed.entity';
import {
    RSS_ARTICLE_PERSIST_JOB,
    RSS_ARTICLE_QUEUE,
    RSS_FEED_CRAWL_JOB,
    RSS_FEED_QUEUE,
} from './rss.constants';

type FeedCrawlJobData = {
    feedId: string;
    url: string;
};

type ArticlePersistJobData = {
    feedId: string;
    guid?: string;
    link?: string;
    title?: string;
    summary: string;
    publishedAt?: string;
};

@Injectable()
export class RssQueueService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RssQueueService.name);
    private readonly parser = new Parser({ timeout: 15000 });
    private readonly articleContentMinimumLength = 600;
    private readonly queueEnabled: boolean;
    private readonly connection?: {
        host: string;
        port: number;
        password?: string;
        maxRetriesPerRequest: null;
        enableReadyCheck: boolean;
    };
    private readonly feedJobOptions: JobsOptions = {
        removeOnComplete: 100,
        removeOnFail: 100,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
    };
    private readonly articleJobOptions: JobsOptions = {
        removeOnComplete: 500,
        removeOnFail: 500,
        attempts: 2,
        backoff: {
            type: 'fixed',
            delay: 2000,
        },
    };

    private feedQueue: Queue<FeedCrawlJobData> | null = null;
    private articleQueue: Queue<ArticlePersistJobData> | null = null;
    private feedWorker: Worker<FeedCrawlJobData> | null = null;
    private articleWorker: Worker<ArticlePersistJobData> | null = null;

    constructor(
        private readonly em: EntityManager,
        private readonly configService: ConfigService,
    ) {
        const enabled =
            this.configService.get<string>('DRAGONFLY_ENABLED') === 'true';
        this.queueEnabled = enabled;

        if (enabled) {
            this.connection = {
                host: this.configService.get<string>('DRAGONFLY_HOST') || 'localhost',
                port: Number(this.configService.get<string>('DRAGONFLY_PORT') || 6379),
                password:
                    this.configService.get<string>('DRAGONFLY_PASSWORD') || undefined,
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
            };
        }
    }

    async onModuleInit(): Promise<void> {
        if (!this.queueEnabled || !this.connection) {
            this.logger.warn(
                'Redis queue is disabled. RSS jobs will run inline on the API/Cron process.',
            );
            return;
        }

        this.feedQueue = new Queue<FeedCrawlJobData>(RSS_FEED_QUEUE, {
            connection: this.connection,
            defaultJobOptions: this.feedJobOptions,
        });

        this.articleQueue = new Queue<ArticlePersistJobData>(RSS_ARTICLE_QUEUE, {
            connection: this.connection,
            defaultJobOptions: this.articleJobOptions,
        });

        this.feedWorker = new Worker<FeedCrawlJobData>(
            RSS_FEED_QUEUE,
            async (job) => this.processFeedJob(job.data),
            {
                connection: this.connection,
                concurrency: 2,
            },
        );

        this.articleWorker = new Worker<ArticlePersistJobData>(
            RSS_ARTICLE_QUEUE,
            async (job) => this.processArticleJob(job.data),
            {
                connection: this.connection,
                concurrency: 1,
            },
        );

        this.feedWorker.on('failed', (job, error) => {
            this.logger.warn(
                `RSS feed job failed (${job?.id ?? 'unknown'}): ${error.message}`,
            );
        });

        this.articleWorker.on('failed', (job, error) => {
            this.logger.warn(
                `RSS article job failed (${job?.id ?? 'unknown'}): ${error.message}`,
            );
        });

        this.logger.log('RSS Redis queues are ready');
    }

    async onModuleDestroy(): Promise<void> {
        await this.feedWorker?.close();
        await this.articleWorker?.close();
        await this.feedQueue?.close();
        await this.articleQueue?.close();
    }

    async enqueueFeedCrawl(feed: RssFeed): Promise<void> {
        const url = feed.url?.trim();
        if (!url) {
            return;
        }

        const payload: FeedCrawlJobData = {
            feedId: feed.id,
            url,
        };

        if (!this.feedQueue) {
            await this.processFeedJob(payload);
            return;
        }

        await this.feedQueue.add(RSS_FEED_CRAWL_JOB, payload, this.feedJobOptions);
    }

    private async processFeedJob(data: FeedCrawlJobData): Promise<void> {
        const em = this.em.fork();
        const feed = await em.findOne(RssFeed, { id: data.feedId });

        if (!feed?.isActive) {
            return;
        }

        const parsedFeed = await this.parser.parseURL(data.url);
        const feedTitle = parsedFeed.title?.trim();
        if (feedTitle) {
            feed.name = feedTitle;
            feed.legacyTitle = feedTitle;
            feed.updatedAt = new Date();
            await em.flush();
        }

        for (const item of parsedFeed.items ?? []) {
            const guid = this.normalize(item.guid);
            const link = this.normalize(item.link);

            if (!guid && !link) {
                continue;
            }

            const payload: ArticlePersistJobData = {
                feedId: feed.id,
                guid,
                link,
                title: this.normalize(item.title),
                summary: this.buildArticleContent(item),
                publishedAt: this.parseDate(item.pubDate)?.toISOString(),
            };

            if (!this.articleQueue) {
                await this.processArticleJob(payload);
                continue;
            }

            const dedupeKey = guid ? `guid:${guid}` : `link:${link}`;
            await this.articleQueue.add(RSS_ARTICLE_PERSIST_JOB, payload, {
                ...this.articleJobOptions,
                jobId: `article:${feed.id}:${dedupeKey}`,
            });
        }
    }

    private async processArticleJob(data: ArticlePersistJobData): Promise<void> {
        const em = this.em.fork();
        const feed = await em.findOne(RssFeed, { id: data.feedId });

        if (!feed) {
            return;
        }

        const resolvedSummary = await this.resolveArticleContent(data);

        const where =
            data.guid && data.link
                ? { $or: [{ guid: data.guid }, { link: data.link }] }
                : data.guid
                    ? { guid: data.guid }
                    : { link: data.link };

        const existingArticle = await em.findOne(RssArticle, where);
        if (existingArticle) {
            const nextSummary = resolvedSummary;
            const shouldUpdateSummary =
                nextSummary.length > (existingArticle.summary?.trim()?.length ?? 0);
            const shouldUpdateTitle =
                !!data.title && data.title !== existingArticle.title;
            const shouldUpdatePublishedAt =
                !!data.publishedAt && !existingArticle.publishedAt;

            if (shouldUpdateSummary || shouldUpdateTitle || shouldUpdatePublishedAt) {
                if (shouldUpdateSummary) {
                    existingArticle.summary = nextSummary;
                }
                if (shouldUpdateTitle) {
                    existingArticle.title = data.title;
                }
                if (shouldUpdatePublishedAt) {
                    existingArticle.publishedAt = new Date(data.publishedAt!);
                }
                existingArticle.updatedAt = new Date();
                await em.flush();
            }

            return;
        }

        const article = em.create(RssArticle, {
            feed,
            guid: data.guid,
            link: data.link,
            title: data.title,
            summary: resolvedSummary,
            isRead: false,
            publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await em.persistAndFlush(article);
    }

    private buildArticleContent(item: Parser.Item): string {
        const rawItem = item as Record<string, unknown>;
        const rawCandidates = [
            rawItem['content:encoded'],
            item.content,
            rawItem.description,
            item.contentSnippet,
        ];

        for (const candidate of rawCandidates) {
            const normalized = this.toSanitizedText(candidate);
            if (normalized) {
                return normalized;
            }
        }

        return '';
    }

    private toSanitizedText(rawValue: unknown): string {
        const rawText = typeof rawValue === 'string' ? rawValue : '';
        if (!rawText.trim()) {
            return '';
        }

        const normalizedBreaks = rawText
            .replace(/<\s*br\s*\/?>/gi, '\n')
            .replace(/<\s*\/p\s*>/gi, '\n\n')
            .replace(/<\s*\/div\s*>/gi, '\n');

        const sanitized = sanitizeHtml(normalizedBreaks, {
            allowedTags: [],
            allowedAttributes: {},
        })
            .replace(/\r/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+/g, ' ')
            .trim();

        return sanitized;
    }

    private async resolveArticleContent(data: ArticlePersistJobData): Promise<string> {
        const feedContent = data.summary?.trim() ?? '';

        if (!data.link) {
            return feedContent;
        }

        if (feedContent.length >= this.articleContentMinimumLength) {
            return feedContent;
        }

        const articleContent = await this.fetchArticleContent(data.link);
        if (!articleContent) {
            return feedContent;
        }

        return articleContent.length > feedContent.length ? articleContent : feedContent;
    }

    private async fetchArticleContent(url: string): Promise<string> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'SimaxWebMailRSSBot/1.0 (+http://localhost)',
                    Accept: 'text/html,application/xhtml+xml',
                },
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                this.logger.warn(`Cannot fetch article content ${url}: ${response.status}`);
                return '';
            }

            const html = await response.text();
            return this.extractMainArticleText(html);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Cannot fetch article content ${url}: ${message}`);
            return '';
        }
    }

    private extractMainArticleText(html: string): string {
        if (!html.trim()) {
            return '';
        }

        const $ = load(html);
        $('script, style, noscript, iframe, svg, nav, footer, header, aside, form').remove();

        const candidates = ['article', 'main', '[role="main"]', '.article-content', '.entry-content', '.post-content', '.content-detail'];
        let bestText = '';

        for (const selector of candidates) {
            $(selector).each((_, element) => {
                const text = this.extractElementText($, $(element));
                if (text.length > bestText.length) {
                    bestText = text;
                }
            });
        }

        if (!bestText) {
            bestText = this.extractElementText($, $('body'));
        }

        return bestText;
    }

    private extractElementText($: ReturnType<typeof load>, root: ReturnType<ReturnType<typeof load>>): string {
        const paragraphs = root
            .find('p, h1, h2, h3, li, blockquote')
            .map((_, element) => this.toSanitizedText($(element).html() ?? $(element).text()))
            .get()
            .filter(Boolean);

        if (paragraphs.length > 0) {
            return paragraphs.join('\n\n').trim();
        }

        return this.toSanitizedText(root.html() ?? root.text());
    }

    private parseDate(pubDate?: string): Date | undefined {
        if (!pubDate) {
            return undefined;
        }

        const parsed = new Date(pubDate);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }

    private normalize(value?: string): string | undefined {
        const normalized = value?.trim();
        return normalized ? normalized : undefined;
    }
}
