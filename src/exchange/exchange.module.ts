import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ExchangeController } from './controllers/exchange.controller';
import { ContactsController } from './controllers/contacts.controller';
import { NotesController } from './controllers/notes.controller';
import { ExchangeAuthService } from './services/exchange-auth.service';
import { CacheModule } from '../common/cache/cache.module';
import { CommonModule } from '../common/common.module';
import { MailService } from './services/mail.service';
import { EwsMailProvider } from './services/ews-mail.provider';
import { SmtpSenderService } from './services/smtp-sender.service';
import { ContactNoteService } from './services/contact-note.service';

@Module({
  imports: [
    CacheModule,
    CommonModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') ||
          'your-secret-key-change-in-production',
        signOptions: {
          expiresIn: configService.get<any>('JWT_EXPIRES_IN') || '15m',
        },
      }),
    }),
  ],
  controllers: [ExchangeController, ContactsController, NotesController],
  providers: [
    ExchangeAuthService,
    SmtpSenderService,
    EwsMailProvider,
    MailService,
    ContactNoteService,
  ],
  exports: [MailService, ExchangeAuthService],
})
export class ExchangeModule {}
