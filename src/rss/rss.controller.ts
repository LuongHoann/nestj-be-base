import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscribeRssFeedDto } from './dto/subscribe-rss-feed.dto';
import { RssArticlesQueryDto } from './dto/rss-articles-query.dto';
import { RssScopeQueryDto } from './dto/rss-scope-query.dto';
import { RssService } from './rss.service';

@ApiTags('Webmail RSS')
@Controller(['webmail/rss', 'api/rss', 'rss'])
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class RssController {
  constructor(private readonly rssService: RssService) { }

  @Get('sidebar')
  @ApiOperation({ summary: 'Lay sidebar RSS feeds' })
  @ApiQuery({ name: 'scope', required: false, enum: ['server'] })
  async getSidebar(
    @CurrentUser() user: { id: string; email: string },
    @Query() query: RssScopeQueryDto,
  ) {
    return this.rssService.getSidebar(user.id, query.scope);
  }

  @Get('articles')
  @ApiOperation({ summary: 'Lay danh sach RSS articles co phan trang' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'feedId', required: false })
  @ApiQuery({ name: 'scope', required: false, enum: ['server'] })
  async getArticles(
    @CurrentUser() user: { id: string; email: string },
    @Query() query: RssArticlesQueryDto,
  ) {
    return this.rssService.getArticles(
      user.id,
      query.page,
      query.limit,
      query.feedId,
      query.scope,
    );
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Dang ky RSS feed moi' })
  async subscribe(
    @CurrentUser() user: { id: string; email: string },
    @Body() dto: SubscribeRssFeedDto,
  ) {
    return this.rssService.subscribe(user.id, dto);
  }

  @Delete('feeds/:feedId')
  @ApiOperation({ summary: 'Bo theo doi RSS feed' })
  async unsubscribe(
    @CurrentUser() user: { id: string; email: string },
    @Param('feedId') feedId: string,
  ) {
    return this.rssService.unsubscribe(user.id, feedId);
  }

  @Put('articles/:id/read')
  @ApiOperation({ summary: 'Danh dau RSS article da doc' })
  async markArticleAsRead(
    @CurrentUser() user: { id: string; email: string },
    @Param('id') id: string,
  ) {
    return this.rssService.markArticleAsRead(user.id, id);
  }
}
