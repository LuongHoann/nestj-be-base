import { ReadStream } from 'fs';

export interface StorageResult {
  storedName: string;
  storagePath: string;
  size: number;
}

/**
 * Storage adapter interface for abstracting file storage operations
 * Enables swapping between local filesystem, S3, GCS, etc.
 */
export interface IStorageAdapter {
  /**
   * Save file to storage (Generic Upload)
   * This is the preferred method for general upload usage.
   */
  upload?(file: Express.Multer.File, path: string): Promise<StorageResult>;

  /**
   * Get a signed URL for public or temporary access.
   * For local storage, this might return a relative publicly accessible path.
   */
  getSignedUrl?(path: string, expiresIn?: number): Promise<string>;

  /**
   * Save file to temporary storage
   * @param file Multer file object
   * @param id ULID identifier for the file
   * @returns Storage metadata
   */
  saveTemp(file: Express.Multer.File, id: string): Promise<StorageResult>;

  /**
   * Move file from temporary to permanent storage
   * @param tempPath Temporary storage path
   * @param permanentPath Permanent storage path
   */
  moveToPermanent(tempPath: string, permanentPath: string): Promise<void>;

  /**
   * Get a readable stream for a file
   * @param path Storage path
   * @returns Readable stream
   */
  getStream(path: string): Promise<ReadStream>;

  /**
   * Delete a file from storage
   * @param path Storage path
   */
  delete(path: string): Promise<void>;

  /**
   * Check if file exists in storage
   * @param path Storage path
   * @returns True if file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file size
   * @param path Storage path
   * @returns File size in bytes
   */
  getSize(path: string): Promise<number>;
}
