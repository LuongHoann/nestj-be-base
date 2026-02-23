import { Module } from '@nestjs/common';
import { ExchangeController } from './controllers/exchange.controller';
import { ExchangeAuthService } from './services/exchange-auth.service';
import { CacheModule } from '../common/cache/cache.module';
import { CommonModule } from '../common/common.module';
import { MailService } from './services/mail.service';
import { EwsMailProvider } from './services/ews-mail.provider';
import { SmtpSenderService } from './services/smtp-sender.service';

@Module({
  imports: [CacheModule, CommonModule],
  controllers: [ExchangeController],
  providers: [
    ExchangeAuthService,
    SmtpSenderService,
    EwsMailProvider,
    MailService,
  ],
  exports: [MailService, ExchangeAuthService],
})
export class ExchangeModule {}
