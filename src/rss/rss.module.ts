import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ExchangeModule } from '../exchange/exchange.module';
import { RssFeed } from '../database/entities/rss-feed.entity';
import { RssArticle } from '../database/entities/rss-article.entity';
import { RssCrawlerService } from './rss-crawler.service';
import { RssController } from './rss.controller';
import { RssService } from './rss.service';

@Module({
  imports: [MikroOrmModule.forFeature([RssFeed, RssArticle]), ExchangeModule],
  controllers: [RssController],
  providers: [RssCrawlerService, RssService],
  exports: [RssCrawlerService, RssService],
})
export class RssModule {}
