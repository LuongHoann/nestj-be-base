import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Query,
  Param,
  UseInterceptors,
  Req,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ExchangeAuthService } from '../services/exchange-auth.service';
import { MailService } from '../services/mail.service';
import {
  ExchangeLoginDto,
  SendMailDto,
  MoveMailDto,
  MarkReadDto,
  MoveBatchDto,
  PermanentDeleteMailDto,
  StarMailDto,
} from '../dto/exchange.dto';
import { ExchangeErrorInterceptor } from '../interceptors/exchange-error.interceptor';
import type { Request, Response } from 'express';
import { ExchangeAuthGuard } from 'src/auth/guards/exchange-auth.guard';
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
    const { accessToken, refreshToken, email } =
      await this.authService.login(dto.email, dto.password);

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
        await (this.authService as any).cache.del(`exchange:refresh:${tokenId}`);
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
  async getFolderCounts() {
    return this.mailService.getFolderCounts();
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('mail')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Danh sach mail theo folder' })
  @ApiQuery({ name: 'folder', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async list(
    @Query('folder') folder: string = 'inbox',
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.mailService.getMessages(folder, Number(page), Number(pageSize));
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('mail/search')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Tim kiem mail' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'page', required: false })
  async search(@Query('q') q: string, @Query('page') page: number = 1) {
    return this.mailService.searchMessages(q, Number(page));
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('mail/:id')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Chi tiet mail' })
  async check(@Param('id') id: string) {
    return this.mailService.getMessage(id);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/send')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Gui mail' })
  @ApiBody({ type: SendMailDto })
  async send(@Body() dto: SendMailDto) {
    return this.mailService.sendMessage(dto);
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
}
