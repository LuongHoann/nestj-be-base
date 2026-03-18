import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ExchangeController } from './controllers/exchange.controller';
import { ContactsController } from './controllers/contacts.controller';
import { NotesController } from './controllers/notes.controller';
import { AdminModerationController } from './controllers/admin-moderation.controller';
import { ExchangeAuthService } from './services/exchange-auth.service';
import { CacheModule } from '../common/cache/cache.module';
import { CommonModule } from '../common/common.module';
import { MailService } from './services/mail.service';
import { EwsMailProvider } from './services/ews-mail.provider';
import { ImapMailProvider } from './services/imap-mail.provider';
import { SmtpSenderService } from './services/smtp-sender.service';
import { ContactNoteService } from './services/contact-note.service';
import { SpamModerationService } from './services/spam-moderation.service';
import { RspamdSyncService } from './services/rspamd-sync.service';
import { SpamReport } from '../database/entities/spam-report.entity';
import { GlobalBlocklist } from '../database/entities/global-blocklist.entity';
import { SecurityPolicy } from '../database/entities/security-policy.entity';

@Module({
  imports: [
    
    CacheModule,
    
    CommonModule,
    MikroOrmModule.forFeature([SpamReport, GlobalBlocklist, SecurityPolicy]),
  ,
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
  controllers: [
    ExchangeController, 
    ContactsController, 
    NotesController,
    AdminModerationController,
  ],
  providers: [
    ExchangeAuthService,
    SmtpSenderService,
    EwsMailProvider,
    ImapMailProvider,
    MailService,
    ContactNoteService,
    SpamModerationService,
    RspamdSyncService,
  ],
  exports: [MailService, ExchangeAuthService],
})
export class ExchangeModule {}
