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
import { ExchangeLoginDto, SendMailDto } from '../dto/exchange.dto';
import { ExchangeErrorInterceptor } from '../interceptors/exchange-error.interceptor';
import type { Request, Response } from 'express'; // Import từ express
import { ExchangeAuthGuard } from 'src/auth/guards/exchange-auth.guard';

@Controller('webmail')
@UseInterceptors(ExchangeErrorInterceptor)
export class ExchangeController {
  constructor(
    private readonly authService: ExchangeAuthService,
    private readonly mailService: MailService,
  ) {}

  @Post('auth/login')
  async login(
    @Body() dto: ExchangeLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(dto.email, dto.password);

    // Maintain cookie for legacy support if needed, but return in body as well
    res.cookie('exchange_session', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000,
    });

    return {
      success: true,
      accessToken,
      refreshToken,
    };
  }

  @Post('auth/refresh')
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
  async logout(
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request, 
    @Res({ passthrough: true }) res: Response
  ) {
    const sessionToken = req.cookies['exchange_session'];

    if (sessionToken) {
      await this.authService.logout(sessionToken);
    }
    
    // Revoke refresh token as well if provided
    if (refreshToken) {
        const [tokenId] = refreshToken.split('.');
        if (tokenId) {
            await (this.authService as any).cache.del(`exchange:refresh:${tokenId}`);
        }
    }

    res.clearCookie('exchange_session');
    return { success: true, message: 'Đăng xuất thành công' };
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('folders')
  async getFolders() {
    return this.mailService.getFolders();
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('mail')
  async list(
    @Query('folder') folder: string = 'inbox',
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.mailService.getMessages(folder, Number(page), Number(pageSize));
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('mail/search')
  async search(@Query('q') q: string, @Query('page') page: number = 1) {
    return this.mailService.searchMessages(q, Number(page));
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('mail/:id')
  async check(@Param('id') id: string) {
    return this.mailService.getMessage(id);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/send')
  async send(@Body() dto: SendMailDto) {
    return this.mailService.sendMessage(dto);
  }
}
