import { Module, Global } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityRegistryService } from './entity-registry.service';
import { MetadataReaderService } from './metadata-reader.service';

@Global()
@Module({
  imports: [MikroOrmModule.forFeature([])], // No specific entities here, just need provider access
  providers: [EntityRegistryService, MetadataReaderService],
  exports: [EntityRegistryService, MetadataReaderService],
})
export class MetaModule {}
