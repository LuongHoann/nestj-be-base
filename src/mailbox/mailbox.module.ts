import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailboxController } from './mailbox.controller';
import { MailboxService } from './mailbox.service';
import { ScriptRunnerService } from './script-runner.service';
import { GalService } from './gal.service';
import { ExchangeAuthService } from '../exchange/services/exchange-auth.service';

@Module({
  imports: [AuthModule],
  controllers: [MailboxController],
  providers: [
    MailboxService,
    ScriptRunnerService,
    GalService,
    ExchangeAuthService,
  ],
})
export class MailboxModule {}
