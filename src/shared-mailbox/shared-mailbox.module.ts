import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SharedMailbox } from '../database/entities/shared-mailbox.entity';
import { SharedMailboxMember } from '../database/entities/shared-mailbox-member.entity';
import { User } from '../database/entities/user.entity';
import { AuditLog } from '../database/entities/audit-log.entity';
import { SharedMailboxScriptRunner } from './shared-mailbox.runner';
import { ExchangeModule } from '../exchange/exchange.module';
import { SharedMailboxService } from './shared-mailbox.service';
import { SharedMailboxController } from './shared-mailbox.controller';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      SharedMailbox,
      SharedMailboxMember,
      User,
      AuditLog,
    ]),
    ExchangeModule,
  ],
  controllers: [SharedMailboxController],
  providers: [SharedMailboxService, SharedMailboxScriptRunner],
  exports: [SharedMailboxService],
})
export class SharedMailboxModule {}
