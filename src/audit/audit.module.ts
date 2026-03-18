import { Module, forwardRef } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLog } from '../database/entities/audit-log.entity';
import { AuditLogService } from './audit.service';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { CommonModule } from '../common/common.module';
import { AuditController } from './audit.controller';
import { AuthModule } from '../auth/auth.module';
import { ExchangeAuthService } from '../exchange/services/exchange-auth.service';

@Module({
  imports: [
    MikroOrmModule.forFeature([AuditLog]),
    CommonModule,
    forwardRef(() => AuthModule),
  ],
  providers: [
    AuditLogService,
    ExchangeAuthService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  controllers: [AuditController],
  exports: [AuditLogService],
})
export class AuditLogModule {}
