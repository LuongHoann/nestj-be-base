import { Module } from '@nestjs/common';
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
import { LibreOfficeConverterService } from './services/libreoffice-converter.service';

@Module({
  imports: [CacheModule, CommonModule],
  controllers: [ExchangeController, ContactsController, NotesController],
  providers: [
    ExchangeAuthService,
    SmtpSenderService,
    EwsMailProvider,
    LibreOfficeConverterService,
    MailService,
    ContactNoteService,
  ],
  exports: [MailService, ExchangeAuthService],
})
export class ExchangeModule {}
