import { EntityManager, FilterQuery } from '@mikro-orm/core';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import Parser from 'rss-parser';
import { RssFeed } from '../database/entities/rss-feed.entity';
import { RssArticle } from '../database/entities/rss-article.entity';
import { UserRssSubscription } from '../database/entities/user-rss-subscription.entity';
import { UserRssState } from '../database/entities/user-rss-state.entity';
import { User } from '../database/entities/user.entity';
import { RssQueueService } from './rss-queue.service';
import { SubscribeRssFeedDto } from './dto/subscribe-rss-feed.dto';

@Injectable()
export class RssService {
  private readonly parser = new Parser({ timeout: 15000 });
  private readonly logger = new Logger(RssService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly rssQueueService: RssQueueService,
  ) { }

  async getSidebar(userId: string, scope?: 'server') {
    this.assertSupportedScope(scope);

    const subscriptions = await this.em.find(
      UserRssSubscription,
      { user: userId },
      {
        populate: ['feed'],
        orderBy: { createdAt: 'DESC' },
      },
    );

    const channels = await Promise.all(
      subscriptions.map(async (subscription) => {
        const feed = subscription.feed;
        const totalArticles = await this.em.count(RssArticle, {
          feed: { id: feed.id },
        });
        const readStates = await this.em.count(UserRssState, {
          user: { id: userId },
          article: { feed: { id: feed.id } },
          isRead: true,
        });

        return {
          id: feed.id,
          name: feed.name || feed.legacyTitle || feed.url,
          url: feed.url,
          unreadCount: Math.max(totalArticles - readStates, 0),
        };
      }),
    );

    return { scope: scope ?? 'user', channels, total: channels.length };
  }

  async getArticles(
    userId: string,
    page = 1,
    limit = 20,
    feedId?: string,
    scope?: 'server',
  ) {
    this.assertSupportedScope(scope);

    const subscriptionWhere: FilterQuery<UserRssSubscription> = {
      user: { id: userId },
    };

    if (feedId) {
      subscriptionWhere.feed = { id: feedId };
    }

    const subscriptions = await this.em.find(UserRssSubscription, subscriptionWhere, {
      populate: ['feed'],
    });

    const feedIds = subscriptions.map((subscription) => subscription.feed.id);
    if (feedIds.length === 0) {
      return {
        scope: scope ?? 'user',
        data: [],
        page: 1,
        limit,
        total: 0,
        totalPages: 0,
      };
    }

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const offset = (safePage - 1) * safeLimit;
    const where: FilterQuery<RssArticle> = {
      feed: { id: { $in: feedIds } },
    };

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

    const articleIds = articles.map((article) => article.id);
    const states = articleIds.length
      ? await this.em.find(UserRssState, {
          user: { id: userId },
          article: { id: { $in: articleIds } },
        })
      : [];
    const stateByArticleId = new Map(
      states.map((state) => [state.article.id, state]),
    );

    return {
      scope: scope ?? 'user',
      data: articles.map((article) => {
        const state = stateByArticleId.get(article.id);

        return {
        id: article.id,
        from:
          article.feed?.name ||
          article.feed?.legacyTitle ||
          article.feed?.url ||
          'RSS Feed',
        subject: article.title || '(No title)',
        preview: article.summary,
        isRead: state?.isRead ?? false,
        isStarred: state?.isStarred ?? false,
        receivedAt: article.publishedAt || article.createdAt,
        originalLink: article.link,
        feedId: article.feed?.id,
        };
      }),
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  private assertSupportedScope(scope?: 'server') {
    if (scope && scope !== 'server') {
      throw new BadRequestException('Only scope=server is supported for RSS');
    }
  }

  async subscribe(userId: string, dto: SubscribeRssFeedDto) {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

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
      await this.ensureUserSubscription(user, existing);
      await this.enqueueFeedCrawlSafely(existing);
      return {
        success: true,
        subscribed: true,
        feed: this.toFeedResponse(existing),
      };
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
    await this.ensureUserSubscription(user, feed);
    await this.enqueueFeedCrawlSafely(feed);
    return {
      success: true,
      subscribed: true,
      feed: this.toFeedResponse(feed),
    };
  }

  async unsubscribe(userId: string, feedId: string) {
    const subscription = await this.em.findOne(
      UserRssSubscription,
      {
        user: { id: userId },
        feed: { id: feedId },
      },
      { populate: ['feed'] },
    );

    if (!subscription) {
      throw new NotFoundException('RSS subscription not found');
    }

    const articleIds = await this.em.find(
      RssArticle,
      { feed: { id: feedId } },
      { fields: ['id'] as never },
    );

    if (articleIds.length > 0) {
      await this.em.nativeDelete(UserRssState, {
        user: { id: userId },
        article: { id: { $in: articleIds.map((article) => article.id) } },
      });
    }

    await this.em.removeAndFlush(subscription);

    return {
      success: true,
      unsubscribed: true,
      feedId,
    };
  }

  async markArticleAsRead(userId: string, id: string) {
    const article = await this.em.findOne(RssArticle, { id }, { populate: ['feed'] });

    if (!article) {
      throw new NotFoundException('RSS article not found');
    }

    const subscription = await this.em.findOne(UserRssSubscription, {
      user: { id: userId },
      feed: { id: article.feed?.id },
    });

    if (!subscription) {
      throw new NotFoundException('RSS article not found for current user');
    }

    const existingState = await this.em.findOne(UserRssState, {
      user: { id: userId },
      article: { id },
    });

    if (existingState) {
      existingState.isRead = true;
      existingState.updatedAt = new Date();
      await this.em.flush();

      return {
        success: true,
        articleId: id,
        isRead: true,
      };
    }

    const state = this.em.create(UserRssState, {
      user: { id: userId } as any,
      article: { id } as any,
      isRead: true,
      isStarred: false,
      updatedAt: new Date(),
    });

    await this.em.persistAndFlush(state);

    return {
      success: true,
      articleId: id,
      isRead: true,
    };
  }

  private async ensureUserSubscription(user: User, feed: RssFeed): Promise<void> {
    const existingSubscription = await this.em.findOne(UserRssSubscription, {
      user: { id: user.id },
      feed: { id: feed.id },
    });

    if (existingSubscription) {
      return;
    }

    try {
      const subscription = this.em.create(UserRssSubscription, {
        user,
        feed,
        createdAt: new Date(),
      });

      await this.em.persistAndFlush(subscription);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('user_rss_subscriptions_user_id_feed_id_key') ||
        message.includes('duplicate key value')
      ) {
        this.logger.warn(
          `RSS subscription already exists for user=${user.id} feed=${feed.id}`,
        );
        return;
      }

      throw error;
    }
  }

  private async enqueueFeedCrawlSafely(feed: RssFeed): Promise<void> {
    try {
      await this.rssQueueService.enqueueFeedCrawl(feed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`RSS crawl enqueue failed for ${feed.url}: ${message}`);
    }
  }

  private toFeedResponse(feed: RssFeed) {
    return {
      id: feed.id,
      url: feed.url,
      name: feed.name,
      legacyTitle: feed.legacyTitle,
      isActive: feed.isActive,
    };
  }
}
