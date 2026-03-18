import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationUnit } from '../database/entities/organization-unit.entity';
import { User } from '../database/entities/user.entity';
import { AuditLog } from '../database/entities/audit-log.entity';
import { ExchangeModule } from '../exchange/exchange.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([OrganizationUnit, User, AuditLog]),
    ExchangeModule,
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
