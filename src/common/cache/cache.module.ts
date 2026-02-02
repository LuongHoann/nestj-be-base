import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import dragonflyConfig from '../../config/dragonfly.config';
import { DragonflyService } from './dragonfly.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(dragonflyConfig)],
  providers: [DragonflyService],
  exports: [DragonflyService],
})
export class CacheModule {}
