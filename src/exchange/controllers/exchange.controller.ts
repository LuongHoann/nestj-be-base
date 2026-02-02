import { Controller, Post, Body, Get, UseGuards, Query, Param, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequestContext } from '../../common/context/request.context';
import { ExchangeAuthService } from '../services/exchange-auth.service';
import { MailService } from '../services/mail.service';
import { ExchangeLoginDto, SendMailDto } from '../dto/exchange.dto';
import { ExchangeErrorInterceptor } from '../interceptors/exchange-error.interceptor';

@Controller('webmail')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ExchangeErrorInterceptor)
export class ExchangeController {
    constructor(
        private readonly authService: ExchangeAuthService,
        private readonly mailService: MailService,
        private readonly context: RequestContext
    ) {}

    @Post('auth/login')
    async login(@Body() dto: ExchangeLoginDto) {
        const userId = String(this.context.user!.id);
        const success = await this.authService.login(userId, dto.email, dto.password);
        return { success };
    }

    @Post('auth/logout')
    async logout() {
        const userId = String(this.context.user!.id);
        await this.authService.logout(userId);
        return { success: true };
    }

    @Get('folders')
    async getFolders() {
        return this.mailService.getFolders();
    }

    @Get('mail')
    async list(
        @Query('folder') folder: string = 'inbox',
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 20
    ) {
        return this.mailService.getMessages(folder, Number(page), Number(pageSize));
    }

    @Get('mail/search')
    async search(
        @Query('q') q: string,
        @Query('page') page: number = 1
    ) {
        return this.mailService.searchMessages(q, Number(page));
    }

    @Get('mail/:id')
    async check(@Param('id') id: string) {
        return this.mailService.getMessage(id);
    }

    @Post('mail/send')
    async send(@Body() dto: SendMailDto) {
        return this.mailService.sendMessage(dto.to, dto.subject, dto.htmlBody, dto.cc);
    }
}
