import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ImapMailProvider } from './imap-mail.provider';
import { MailMessage } from '../interfaces/mail-provider.interface';
import { SendMailDto, MarkReadDto } from '../dto/exchange.dto';
import { DragonflyService } from '../../common/cache/dragonfly.service';
import { ExchangeAuthService } from './exchange-auth.service';

@Injectable({ scope: Scope.REQUEST })
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly provider: ImapMailProvider,
    private readonly dragonfly: DragonflyService,
    private readonly authService: ExchangeAuthService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private async withProvider<T>(operation: () => Promise<T>): Promise<T> {
    try {
      await this.provider.connect();
      return await operation();
    } catch (error) {
      this.logger.error(`Mail operation failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await this.provider.disconnect();
    }
  }

  private async getEmailFromSession(): Promise<string | null> {
    const token = this.request.cookies?.['exchange_session'];
    if (!token) return null;
    const creds = await this.authService.getCredentials(token);
    return creds?.email || null;
  }

  private mapFolderTypeToId(type: string, defaultValue?: string): string {
    switch (type.toLowerCase()) {
      case 'inbox':
        return 'INBOX';
      case 'sent':
        return 'Sent Items';
      case 'drafts':
        return 'Drafts';
      case 'trash':
        return 'Deleted Items';
      case 'spam':
        return 'Spam';
      default:
        return defaultValue !== undefined ? defaultValue : 'INBOX';
    }
  }

  private mapIdToFolderType(id: string): string {
    switch (id) {
      case 'INBOX':
        return 'inbox';
      case 'Sent Items':
        return 'sent';
      case 'Drafts':
        return 'drafts';
      case 'Deleted Items':
        return 'trash';
      case 'Spam':
        return 'spam';
      default:
        return id.toLowerCase().replace(/\s+/g, '_');
    }
  }

  async getFolderCounts() {
    const email = await this.getEmailFromSession();
    if (!email) {
      // If no email (not logged in?), let provider handle authentication error
      return this.withProvider(() => this.provider.getFolderCounts());
    }

    const standardFolders = ['INBOX', 'Sent Items', 'Drafts', 'Spam', 'Junk Email'];
    const cacheKeys = standardFolders.map((f) => `exchange:count:${email}:${f}`);

    // Check cache
    if (this.dragonfly.enabled) {
      const cachedValues = await Promise.all(
        cacheKeys.map((key) => this.dragonfly.get(key)),
      );

      const result: Record<string, { total: number; unread: number }> = {};
      let allFound = true;

      standardFolders.forEach((folder, index) => {
        if (cachedValues[index]) {
          const type = this.mapIdToFolderType(folder);
          // If multiple IDs map to same type (e.g. Spam/Junk -> spam), we might overwrite/merge?
          // For now, simpler to just assign. If Spam & Junk both exist, last one wins.
          result[type] = cachedValues[index] as any;
        } else {
          allFound = false;
        }
      });

      if (allFound) {
        return result;
      }
    }

    // Cache miss or partial miss
    const counts = await this.withProvider(() => this.provider.getFolderCounts());

    // Set cache
    if (this.dragonfly.enabled) {
      const ttl = 300; // 5 minutes
      await Promise.all(
        Object.entries(counts).map(([folder, count]) =>
          this.dragonfly.set(`exchange:count:${email}:${folder}`, count, ttl),
        ),
      );
    }

    // Transform keys for output
    const mappedCounts: Record<string, { total: number; unread: number }> = {};
    for (const [id, count] of Object.entries(counts)) {
      const type = this.mapIdToFolderType(id);
      mappedCounts[type] = count;
    }

    return mappedCounts;
  }

  async getFolders() {
    return this.withProvider(() => this.provider.getFolders());
  }

  async getMessages(folderType: string, page: number = 1, pageSize: number = 20) {
    const folderId = this.mapFolderTypeToId(folderType);
    return this.withProvider(() =>
      this.provider.getMessages(folderId, page, pageSize),
    );
  }

  async getMessage(id: string) {
    const message = await this.withProvider(() => this.provider.getMessage(id));
    
    try {
        const email = await this.getEmailFromSession();
        if (email && this.dragonfly.enabled) {
            // Decode ID to get folder
            // id is base64(folder:uid)
            const decoded = Buffer.from(id, 'base64').toString('utf8');
            const [folder] = decoded.split(':');
            
            const key = `exchange:count:${email}:${folder}`;
            const current = await this.dragonfly.get<{ total: number; unread: number }>(key);
            
            if (current && current.unread > 0) {
                 await this.dragonfly.del(key);
            }
        }
    } catch (e) {
        // ignore cache errors
    }

    return message;
  }

  async sendMessage(dto: SendMailDto) {
    return this.withProvider(() => this.provider.sendMessage(dto));
  }

  async searchMessages(query: string, page: number = 1, pageSize: number = 20) {
    return this.withProvider(() => this.provider.search(query, page, pageSize));
  }

  async moveMessage(messageId: string, targetFolderType: string) {
    const targetFolderId = this.mapFolderTypeToId(targetFolderType, targetFolderType);
    return this.withProvider(() =>
      this.provider.moveMessage(messageId, targetFolderId),
    );
  }

  async markAsRead(dto: MarkReadDto) {
    const email = await this.getEmailFromSession();

    await this.withProvider(async () => {
      if (dto.all && dto.folder) {
        const folderId = this.mapFolderTypeToId(dto.folder);
        await this.provider.markAllMessages(folderId, dto.isRead);

        // Invalidate cache for this folder
        if (email && this.dragonfly.enabled) {
          const key = `exchange:count:${email}:${folderId}`;
          await this.dragonfly.del(key);
        }
      } else if (dto.ids && dto.ids.length > 0) {
        await this.provider.markMessages(dto.ids, dto.isRead);

        // Invalidate affected folders
        if (email && this.dragonfly.enabled) {
          const folders = new Set<string>();
          for (const id of dto.ids) {
            try {
              const decoded = Buffer.from(id, 'base64').toString('utf8');
              const [folder] = decoded.split(':');
              if (folder) folders.add(folder);
            } catch (e) {}
          }

          for (const folder of folders) {
            const key = `exchange:count:${email}:${folder}`;
            await this.dragonfly.del(key);
          }
        }
      }
    });

    // Refresh cache completely to ensure accurate counts
    if (email) {
      await this.getFolderCounts();
    }

    return { success: true };
  }
}
