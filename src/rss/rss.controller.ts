import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SubscribeRssFeedDto } from './dto/subscribe-rss-feed.dto';
import { RssArticlesQueryDto } from './dto/rss-articles-query.dto';
import { RssScopeQueryDto } from './dto/rss-scope-query.dto';
import { RssService } from './rss.service';

@ApiTags('Webmail RSS')
@Controller(['webmail/rss', 'api/rss', 'rss'])
export class RssController {
  constructor(private readonly rssService: RssService) {}

  @Get('sidebar')
  @ApiOperation({ summary: 'Lay sidebar RSS feeds' })
  @ApiQuery({ name: 'scope', required: false, enum: ['server'] })
  async getSidebar(@Query() query: RssScopeQueryDto) {
    return this.rssService.getSidebar(query.scope);
  }

  @Get('articles')
  @ApiOperation({ summary: 'Lay danh sach RSS articles co phan trang' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'feedId', required: false })
  @ApiQuery({ name: 'scope', required: false, enum: ['server'] })
  async getArticles(@Query() query: RssArticlesQueryDto) {
    return this.rssService.getArticles(
      query.page,
      query.limit,
      query.feedId,
      query.scope,
    );
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Dang ky RSS feed moi' })
  async subscribe(@Body() dto: SubscribeRssFeedDto) {
    return this.rssService.subscribe(dto);
  }

  @Put('articles/:id/read')
  @ApiOperation({ summary: 'Danh dau RSS article da doc' })
  async markArticleAsRead(@Param('id') id: string) {
    return this.rssService.markArticleAsRead(id);
  }
}
