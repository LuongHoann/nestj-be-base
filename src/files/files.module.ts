import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ScheduleModule } from '@nestjs/schedule';
import { File } from '../database/entities/file.entity';
import { FilesController, AssetsController } from './files.controller';
import { FilesService } from './files.service';
import { FilesScheduler } from './files.scheduler';
import { StorageService } from '../storage/storage.service';
import { LocalStorageAdapter } from '../storage/local-storage.adapter';

@Module({
  imports: [MikroOrmModule.forFeature([File]), ScheduleModule.forRoot()],
  controllers: [FilesController, AssetsController],
  providers: [FilesService, FilesScheduler, StorageService, LocalStorageAdapter],
  exports: [FilesService],
})
export class FilesModule {}
