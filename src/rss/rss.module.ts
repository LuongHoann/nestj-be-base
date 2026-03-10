import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from '../auth/auth.module';
import { RssFeed } from '../database/entities/rss-feed.entity';
import { RssArticle } from '../database/entities/rss-article.entity';
import { UserRssSubscription } from '../database/entities/user-rss-subscription.entity';
import { UserRssState } from '../database/entities/user-rss-state.entity';
import { RssCrawlerService } from './rss-crawler.service';
import { RssController } from './rss.controller';
import { RssQueueService } from './rss-queue.service';
import { RssService } from './rss.service';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      RssFeed,
      RssArticle,
      UserRssSubscription,
      UserRssState,
    ]),
    AuthModule,
  ],
  controllers: [RssController],
  providers: [RssCrawlerService, RssQueueService, RssService],
  exports: [RssCrawlerService, RssQueueService, RssService],
})
export class RssModule { }
