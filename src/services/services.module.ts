import { Module } from '@nestjs/common';
import { ItemsService } from './items.service'; // Adjust path if needed or just export provider
import { CommonModule } from '../common/common.module';
import { QueryModule } from '../query/query.module';
import { RepositoryModule } from '../repository/repository.module';
import { MetaModule } from '../meta/meta.module';
import { ItemsController } from '../controllers/items.controller';

@Module({
  imports: [CommonModule, QueryModule, RepositoryModule, MetaModule],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ServicesModule {}
