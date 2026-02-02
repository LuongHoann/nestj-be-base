import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLog } from '../database/entities/audit-log.entity';
import { AuditLogService } from './audit.service';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([AuditLog]),
    CommonModule,
  ],
  providers: [
    AuditLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [AuditLogService],
})
export class AuditLogModule {}
