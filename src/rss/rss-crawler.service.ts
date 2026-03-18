import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EntityManager } from '@mikro-orm/core';
import { RssFeed } from '../database/entities/rss-feed.entity';
import { RssQueueService } from './rss-queue.service';

@Injectable()
export class RssCrawlerService {
  private readonly logger = new Logger(RssCrawlerService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly rssQueueService: RssQueueService,
  ) { }

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

    for (const [url, feed] of uniqueFeeds) {
      try {
        await this.rssQueueService.enqueueFeedCrawl(feed);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`RSS queue enqueue failed for ${url}: ${message}`);
      }
    }

    this.logger.log(
      `Finished RSS crawl enqueue. feeds=${uniqueFeeds.size}`,
    );
  }
}
