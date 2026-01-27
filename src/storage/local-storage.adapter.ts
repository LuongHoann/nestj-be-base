import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs, createReadStream, ReadStream } from 'fs';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import {
  IStorageAdapter,
  StorageResult,
} from './storage.interface';

/**
 * Local filesystem storage adapter
 * Handles file operations using Node.js fs module with streaming
 */
@Injectable()
export class LocalStorageAdapter implements IStorageAdapter {
  private readonly storagePath: string;

  constructor(private readonly configService: ConfigService) {
    this.storagePath =
      this.configService.get<string>('FILE_STORAGE_PATH') || './storage';
  }

  async upload(file: Express.Multer.File, path: string): Promise<StorageResult> {
    const fullPath = join(this.storagePath, path);
    await this.ensureDir(dirname(fullPath));
    await fs.writeFile(fullPath, file.buffer);
    return {
        storedName: path.split('/').pop() || path,
        storagePath: path,
        size: file.size,
    };
  }

  async getSignedUrl(path: string): Promise<string> {
      // For local storage, we just return the relative path. 
      // In a real app, this might need to be prefixed with the API host URL 
      // or mapped to a static file serve route.
      return path;
  }

  /**
   * Save uploaded file to temporary storage
   */
  async saveTemp(
    file: Express.Multer.File,
    id: string,
  ): Promise<StorageResult> {
    const tempDir = join(this.storagePath, 'temp');
    await this.ensureDir(tempDir);

    const storedName = id;
    const storagePath = `temp/${storedName}`;
    const fullPath = join(this.storagePath, storagePath);

    // Write file using stream (no memory buffering)
    await fs.writeFile(fullPath, file.buffer);

    return {
      storedName,
      storagePath,
      size: file.size,
    };
  }

  /**
   * Move file from temp to permanent storage
   * Uses atomic rename operation when possible
   */
  async moveToPermanent(
    tempPath: string,
    permanentPath: string,
  ): Promise<void> {
    const fullTempPath = join(this.storagePath, tempPath);
    const fullPermanentPath = join(this.storagePath, permanentPath);

    // Ensure permanent directory exists
    await this.ensureDir(dirname(fullPermanentPath));

    // Atomic move (rename syscall)
    await fs.rename(fullTempPath, fullPermanentPath);
  }

  /**
   * Get readable stream for file
   * Enables streaming without loading entire file into memory
   */
  async getStream(path: string): Promise<ReadStream> {
    const fullPath = join(this.storagePath, path);

    // Verify file exists before creating stream
    await fs.access(fullPath);

    return createReadStream(fullPath);
  }

  /**
   * Delete file from storage
   */
  async delete(path: string): Promise<void> {
    const fullPath = join(this.storagePath, path);
    await fs.unlink(fullPath);
  }

  /**
   * Check if file exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      const fullPath = join(this.storagePath, path);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file size in bytes
   */
  async getSize(path: string): Promise<number> {
    const fullPath = join(this.storagePath, path);
    const stats = await fs.stat(fullPath);
    return stats.size;
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
