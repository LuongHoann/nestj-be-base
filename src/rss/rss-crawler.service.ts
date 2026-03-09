import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EntityManager } from '@mikro-orm/core';
import Parser from 'rss-parser';
import sanitizeHtml from 'sanitize-html';
import { RssFeed } from '../database/entities/rss-feed.entity';
import { RssArticle } from '../database/entities/rss-article.entity';

@Injectable()
export class RssCrawlerService {
  private readonly logger = new Logger(RssCrawlerService.name);
  private readonly parser = new Parser({ timeout: 15000 });

  constructor(private readonly em: EntityManager) {}

  @Cron('0 */30 * * * *', {
    name: 'rss-news-pooling',
    timeZone: 'UTC',
  })
  async crawlFeeds(): Promise<void> {
    this.logger.log('Starting RSS news pooling');

    const feedRows = await this.em.find(RssFeed, {});
    const uniqueFeeds = new Map<string, RssFeed>();

    for (const feed of feedRows) {
      const normalizedUrl = feed.url?.trim();
      if (!normalizedUrl) {
        continue;
      }

      if (!uniqueFeeds.has(normalizedUrl)) {
        uniqueFeeds.set(normalizedUrl, feed);
      }
    }

    let insertedCount = 0;
    let skippedCount = 0;

    for (const [url, feed] of uniqueFeeds) {
      try {
        const parsedFeed = await this.parser.parseURL(url);

        for (const item of parsedFeed.items ?? []) {
          const guid = this.normalize(item.guid);
          const link = this.normalize(item.link);

          if (!guid && !link) {
            skippedCount += 1;
            continue;
          }

          const where = guid && link ? { $or: [{ guid }, { link }] } : guid ? { guid } : { link };
          const existingArticle = await this.em.findOne(RssArticle, where);

          if (existingArticle) {
            skippedCount += 1;
            continue;
          }

          const article = this.em.create(RssArticle, {
            feed,
            guid,
            link,
            title: this.normalize(item.title),
            summary: this.buildSummary(
              item.contentSnippet ?? item.description ?? '',
            ),
            isRead: false,
            publishedAt: this.parseDate(item.pubDate),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          this.em.persist(article);
          insertedCount += 1;
        }

        await this.em.flush();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`RSS fetch failed for ${url}: ${message}`);
      }
    }

    this.logger.log(
      `Finished RSS crawl. inserted=${insertedCount}, skipped=${skippedCount}, feeds=${uniqueFeeds.size}`,
    );
  }

  private buildSummary(rawText: string): string {
    const sanitized = sanitizeHtml(rawText, {
      allowedTags: [],
      allowedAttributes: {},
    })
      .replace(/\s+/g, ' ')
      .trim();

    return sanitized.slice(0, 250);
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
