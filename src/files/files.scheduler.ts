import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilesService } from './files.service';

/**
 * Scheduled task for cleanup of old temporary files
 * Runs every 5 days
 */
@Injectable()
export class FilesScheduler {
  private readonly logger = new Logger(FilesScheduler.name);

  constructor(private readonly filesService: FilesService) {}

  /**
   * Delete temp files older than 5 days
   * Runs every 5 days at midnight
   */
  @Cron('0 0 */5 * *', {
    name: 'cleanup-temp-files',
    timeZone: 'UTC',
  })
  async handleTempFileCleanup() {
    this.logger.log('Starting temp file cleanup task');

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    try {
      const deletedCount =
        await this.filesService.cleanupTempFiles(fiveDaysAgo);
      this.logger.log(`Deleted ${deletedCount} old temp files`);
    } catch (error) {
      this.logger.error('Error during temp file cleanup:', error);
    }
  }
}
