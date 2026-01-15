import { Module, Global } from '@nestjs/common';
import { GenericRepository } from './generic.repository';
import { MetaModule } from '../meta/meta.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Global()
@Module({
  imports: [MetaModule, MikroOrmModule.forFeature([])],
  providers: [GenericRepository],
  exports: [GenericRepository],
})
export class RepositoryModule {}
