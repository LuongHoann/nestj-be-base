import { Injectable } from '@nestjs/common';
import { ReadStream } from 'fs';
import { IStorageAdapter, StorageResult } from './storage.interface';
import { LocalStorageAdapter } from './local-storage.adapter';

/**
 * Storage service wrapper
 * Provides high-level storage operations
 */
@Injectable()
export class StorageService {
  constructor(private readonly adapter: LocalStorageAdapter) {}

  async saveTemp(
    file: Express.Multer.File,
    id: string,
  ): Promise<StorageResult> {
    return this.adapter.saveTemp(file, id);
  }

  async moveToPermanent(
    tempPath: string,
    permanentPath: string,
  ): Promise<void> {
    return this.adapter.moveToPermanent(tempPath, permanentPath);
  }

  async getStream(path: string): Promise<ReadStream> {
    return this.adapter.getStream(path);
  }

  async delete(path: string): Promise<void> {
    return this.adapter.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.adapter.exists(path);
  }

  async getSize(path: string): Promise<number> {
    return this.adapter.getSize(path);
  }
}
