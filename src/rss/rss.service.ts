import { EntityManager, FilterQuery } from '@mikro-orm/core';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Parser from 'rss-parser';
import { RssFeed } from '../database/entities/rss-feed.entity';
import { RssArticle } from '../database/entities/rss-article.entity';
import { SubscribeRssFeedDto } from './dto/subscribe-rss-feed.dto';

@Injectable()
export class RssService {
  private readonly parser = new Parser({ timeout: 15000 });

  constructor(private readonly em: EntityManager) {}

  async getSidebar(scope?: 'server') {
    this.assertServerScope(scope);

    const feeds = await this.em.find(
      RssFeed,
      {},
      {
        orderBy: { createdAt: 'DESC' },
      },
    );

    const channels = await Promise.all(
      feeds.map(async (feed) => {
        const unreadCount = await this.em.count(RssArticle, {
          feed: feed.id,
          isRead: false,
        });

        return {
          id: feed.id,
          name: feed.name || feed.legacyTitle || feed.url,
          url: feed.url,
          unreadCount,
        };
      }),
    );

    return { scope: 'server', channels, total: channels.length };
  }

  async getArticles(
    page = 1,
    limit = 20,
    feedId?: string,
    scope?: 'server',
  ) {
    this.assertServerScope(scope);

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const offset = (safePage - 1) * safeLimit;
    const where: FilterQuery<RssArticle> = {};

    if (feedId) {
      where.feed = { id: feedId };
    }

    const [articles, total] = await this.em.findAndCount(
      RssArticle,
      where,
      {
        offset,
        limit: safeLimit,
        orderBy: {
          publishedAt: 'DESC',
          createdAt: 'DESC',
        },
        populate: ['feed'],
      },
    );

    return {
      scope: 'server',
      data: articles.map((article) => ({
        id: article.id,
        from: article.feed?.name || article.feed?.url || 'RSS Feed',
        subject: article.title || '(No title)',
        preview: article.summary,
        isRead: article.isRead,
        isStarred: false,
        receivedAt: article.publishedAt || article.createdAt,
        originalLink: article.link,
        feedId: article.feed?.id,
      })),
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  private assertServerScope(scope?: 'server') {
    if (scope && scope !== 'server') {
      throw new BadRequestException('Only scope=server is supported for RSS');
    }
  }

  async subscribe(dto: SubscribeRssFeedDto) {
    const normalizedUrl = dto.url.trim();
    let parsedFeedTitle: string | undefined;

    try {
      const parsedFeed = await this.parser.parseURL(normalizedUrl);
      parsedFeedTitle = parsedFeed.title?.trim() || undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Invalid RSS feed URL: ${message}`);
    }

    const existing = await this.em.findOne(RssFeed, {
      url: normalizedUrl,
    });

    if (existing) {
      existing.name = dto.name?.trim() || parsedFeedTitle || existing.name;
      existing.legacyTitle =
        dto.name?.trim() || parsedFeedTitle || existing.legacyTitle;
      existing.isActive = true;
      existing.updatedAt = new Date();

      await this.em.flush();
      return existing;
    }

    const feed = this.em.create(RssFeed, {
      url: normalizedUrl,
      name: dto.name?.trim() || parsedFeedTitle,
      legacyTitle: dto.name?.trim() || parsedFeedTitle || normalizedUrl,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.em.persistAndFlush(feed);
    return feed;
  }

  async markArticleAsRead(id: string) {
    const article = await this.em.findOne(RssArticle, { id });

    if (!article) {
      throw new NotFoundException('RSS article not found');
    }

    article.isRead = true;
    article.readAt = new Date();
    article.updatedAt = new Date();

    await this.em.flush();

    return {
      success: true,
      article,
    };
  }
}
