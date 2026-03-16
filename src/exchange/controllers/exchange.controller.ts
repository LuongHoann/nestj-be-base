import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Query,
  UseInterceptors,
  Req,
  Res,
  Put,
  Delete,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ExchangeAuthService } from '../services/exchange-auth.service';
import { MailService } from '../services/mail.service';
import {
  ExchangeLoginDto,
  SendMailDto,
  SaveDraftDto,
  MoveMailDto,
  MarkReadDto,
  MoveBatchDto,
  PermanentDeleteMailDto,
  StarMailDto,
  ReplyMailDto,
  ForwardMailDto,
} from '../dto/exchange.dto';
import { CreateEventDto, UpdateEventDto } from '../dto/calendar.dto';

import { ExchangeErrorInterceptor } from '../interceptors/exchange-error.interceptor';
import type { Request, Response } from 'express';
import { ExchangeAuthGuard } from '../../auth/guards/exchange-auth.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Webmail')
@Controller('webmail')
@UseInterceptors(ExchangeErrorInterceptor)
export class ExchangeController {
  constructor(
    private readonly authService: ExchangeAuthService,
    private readonly mailService: MailService,
  ) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Dang nhap mailbox' })
  @ApiBody({ type: ExchangeLoginDto })
  @ApiResponse({ status: 200, description: 'Exchange session tokens' })
  async login(
    @Body() dto: ExchangeLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, email } = await this.authService.login(
      dto.email,
      dto.password,
    );

    res.cookie('exchange_session', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000,
    });

    return {
      success: true,
      email,
      accessToken,
      refreshToken,
    };
  }

  @Post('auth/refresh')
  @ApiOperation({ summary: 'Refresh exchange token' })
  async refresh(
    @Body('refreshToken') refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.rotateRefreshToken(refreshToken);

    res.cookie('exchange_session', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000,
    });

    return tokens;
  }

  @Post('auth/logout')
  @ApiOperation({ summary: 'Logout exchange session' })
  async logout(
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionToken = req.cookies['exchange_session'];

    if (sessionToken) {
      await this.authService.logout(sessionToken);
    }

    if (refreshToken) {
      const [tokenId] = refreshToken.split('.');
      if (tokenId) {
        await (this.authService as any).cache.del(
          `exchange:refresh:${tokenId}`,
        );
      }
    }

    res.clearCookie('exchange_session');
    return { success: true, message: 'Dang xuat thanh cong' };
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('folders')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Danh sach folder' })
  async getFolders() {
    return this.mailService.getFolders();
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('folders/counts')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Dem mail theo folder' })
  @ApiQuery({ name: 'mailbox', required: false })
  async getFolderCounts(@Query('mailbox') mailbox?: string) {
    return this.mailService.getFolderCounts(mailbox);
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('mail')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Danh sach mail theo folder' })
  @ApiQuery({ name: 'folder', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'mailbox', required: false })
  async list(
    @Query('folder') folder: string = 'inbox',
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('mailbox') mailbox?: string,
  ) {
    return this.mailService.getMessages(folder, Number(page), Number(pageSize), mailbox);
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('mail/search')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Tim kiem mail nang cao' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'folder', required: false })
  @ApiQuery({ name: 'mailbox', required: false })
  async search(
    @Query('q') q: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('folder') folder: string = 'inbox',
    @Query('mailbox') mailbox?: string,
  ) {
    return this.mailService.searchMessages(
      q,
      Number(page),
      Number(pageSize),
      folder,
      mailbox,
    );
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('mail/conversation')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({
    summary:
      'Lấy toàn bộ email trong cùng một luồng hội thoại theo messageId gốc',
  })
  async getConversation(
    @Query('messageId') messageId: string,
    @Query('maxItems') maxItems?: string,
  ) {
    if (!messageId) {
      throw new Error('messageId là bắt buộc');
    }
    const max = maxItems ? parseInt(maxItems, 10) : 50;
    return this.mailService.getConversationMessages(messageId, max);
  }
  @UseGuards(ExchangeAuthGuard)
  @Get('mail/:id/attachments/:index')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Tai attachment cua mail' })
  async downloadAttachment(
    @Param('id') id: string,
    @Param('index') index: string,
    @Query('download') download: string = 'true',
    @Res() res: Response,
  ) {
    const attachment = await this.mailService.downloadAttachment(
      id,
      Number(index),
    );

    const disposition =
      download === 'false'
        ? 'inline'
        : `attachment; filename="${encodeURIComponent(attachment.filename)}"`;

    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Length', attachment.size.toString());
    res.send(attachment.content);
  }
  @UseGuards(ExchangeAuthGuard)
  @Get('mail/:id')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Chi tiết mail' })
  async check(@Param('id') id: string) {
    return this.mailService.getMessage(id);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/send')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Gửi mail' })
  @ApiBody({ type: SendMailDto })
  async send(@Body() dto: SendMailDto) {
    return this.mailService.sendMessage(dto);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/draft')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Lưu nháp' })
  @ApiBody({ type: SaveDraftDto })
  async saveDraft(@Body() dto: SaveDraftDto) {
    return this.mailService.saveDraft(dto);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/move')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Move 1 mail' })
  @ApiBody({ type: MoveMailDto })
  async move(@Body() dto: MoveMailDto) {
    return this.mailService.moveMessage(dto.messageId, dto.targetFolder);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/mark-as-read')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Mark read/unread' })
  @ApiBody({ type: MarkReadDto })
  async markAsRead(@Body() dto: MarkReadDto) {
    return this.mailService.markAsRead(dto);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/move-batch')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Move batch mail' })
  @ApiBody({ type: MoveBatchDto })
  async moveBatch(@Body() dto: MoveBatchDto) {
    return this.mailService.moveMessagesBatch(dto);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/permanent-delete')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Xoa vinh vien mail' })
  @ApiBody({ type: PermanentDeleteMailDto })
  async permanentDelete(@Body() dto: PermanentDeleteMailDto) {
    return this.mailService.permanentDelete(dto);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/star')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Danh dau sao' })
  @ApiBody({ type: StarMailDto })
  async star(@Body() dto: StarMailDto) {
    return this.mailService.markStar(dto);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/unstar')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Bo danh dau sao' })
  @ApiBody({ type: StarMailDto })
  async unstar(@Body() dto: StarMailDto) {
    return this.mailService.unmarkStar(dto);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/reply')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Trả lời email (Reply / Reply All)' })
  @ApiBody({ type: ReplyMailDto })
  async reply(@Body() dto: ReplyMailDto) {
    return this.mailService.replyMessage(dto);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/forward')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Chuyển tiếp email (Forward)' })
  @ApiBody({ type: ForwardMailDto })
  async forward(@Body() dto: ForwardMailDto) {
    return this.mailService.forwardMessage(dto);
  }

  // ─── LỊCH & SỰ KIỆN (CALENDAR & REMINDERS) ───────────────────────────────────

  @UseGuards(ExchangeAuthGuard)
  @Get('calendar')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Lấy các sự kiện trong khoảng thời gian' })
  async getEvents(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.mailService.getEvents(startDate, endDate);
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('calendar/reminders/active')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({
    summary: 'Lấy danh sách lời nhắc (Reminders) đang kích hoạt',
  })
  async getActiveReminders() {
    return this.mailService.getActiveReminders();
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('calendar/reminders/dismiss/:id')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Ẩn/Tắt lời nhắc cho một sự kiện cụ thể' })
  async dismissReminder(@Param('id') id: string) {
    await this.mailService.dismissReminder(id);
    return { success: true };
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('calendar')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Tạo một sự kiện mới' })
  @ApiBody({ type: CreateEventDto })
  async createEvent(@Body() dto: CreateEventDto) {
    const id = await this.mailService.createEvent(dto);
    return { success: true, id };
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('calendar/:id')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Xem chi tiết một sự kiện' })
  async getEventDetails(@Param('id') id: string) {
    return this.mailService.getEventDetails(id);
  }

  @UseGuards(ExchangeAuthGuard)
  @Put('calendar/:id')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Cập nhật sự kiện' })
  @ApiBody({ type: UpdateEventDto })
  async updateEvent(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    await this.mailService.updateEvent(id, dto);
    return { success: true };
  }

  @UseGuards(ExchangeAuthGuard)
  @Delete('calendar/:id')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Xoá sự kiện' })
  async deleteEvent(@Param('id') id: string) {
    await this.mailService.deleteEvent(id);
    return { success: true };
  }
}

