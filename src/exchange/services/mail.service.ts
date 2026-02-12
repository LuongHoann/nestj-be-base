import { BadRequestException, Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ImapMailProvider } from './imap-mail.provider';
import { MailMessage } from '../interfaces/mail-provider.interface';
import {
  SendMailDto,
  MarkReadDto,
  MoveBatchDto,
  PermanentDeleteMailDto,
} from '../dto/exchange.dto';
import { DragonflyService } from '../../common/cache/dragonfly.service';
import { ExchangeAuthService } from './exchange-auth.service';
import {
  DEFAULT_FOLDER_ID,
  MAIL_FOLDERS,
  resolveFolderId,
  resolveFolderType,
} from '../constants/mail-folders.constant';

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
    return resolveFolderId(type, defaultValue ?? DEFAULT_FOLDER_ID);
  }

  private mapIdToFolderType(id: string): string {
    return resolveFolderType(id);
  }

  async getFolderCounts() {
    const email = await this.getEmailFromSession();
    if (!email) {
      // If no email (not logged in?), let provider handle authentication error
      return this.withProvider(() => this.provider.getFolderCounts());
    }

    const standardFolders = MAIL_FOLDERS.map((f) => f.id);
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
            const [rawFolder] = decoded.split(':');
            const folder = resolveFolderId(rawFolder, rawFolder);
            
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
    const result = await this.withProvider(() => this.provider.sendMessage(dto));

    const email = await this.getEmailFromSession();
    if (email && this.dragonfly.enabled) {
      await this.dragonfly.del(`exchange:count:${email}:Sent Items`);
      await this.dragonfly.del(`exchange:count:${email}:INBOX`);
    }

    return result;
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
              const [rawFolder] = decoded.split(':');
              const folder = resolveFolderId(rawFolder, rawFolder);
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

  async moveMessagesBatch(dto: MoveBatchDto) {
    const email = await this.getEmailFromSession();
    const targetFolderId = this.mapFolderTypeToId(
      dto.targetFolder,
      dto.targetFolder,
    );

    await this.withProvider(async () => {
      if (dto.all && dto.sourceFolder) {
        const sourceFolderId = this.mapFolderTypeToId(dto.sourceFolder);
        await this.provider.moveAllMessages(sourceFolderId, targetFolderId);

        // Invalidate cache for source and target
        if (email && this.dragonfly.enabled) {
          await this.dragonfly.del(
            `exchange:count:${email}:${sourceFolderId}`,
          );
          await this.dragonfly.del(
            `exchange:count:${email}:${targetFolderId}`,
          );
        }
      } else if (dto.ids && dto.ids.length > 0) {
        await this.provider.moveMessagesBatch(dto.ids, targetFolderId);

        // Invalidate affected folders
        if (email && this.dragonfly.enabled) {
          const folders = new Set<string>();
          folders.add(targetFolderId);

          for (const id of dto.ids) {
            try {
              const decoded = Buffer.from(id, 'base64').toString('utf8');
              const [rawFolder] = decoded.split(':');
              const folder = resolveFolderId(rawFolder, rawFolder);
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

    if (email) {
      await this.getFolderCounts();
    }

    return { success: true };
  }

  async permanentDelete(dto: PermanentDeleteMailDto) {
    const hasSingle = !!dto.messageId;
    const hasMany = Array.isArray(dto.ids) && dto.ids.length > 0;
    const hasDeleteAll = !!dto.all && !!dto.sourceFolder;

    const selectedModes = [hasSingle, hasMany, hasDeleteAll].filter(Boolean).length;
    if (selectedModes !== 1) {
      throw new BadRequestException(
        'Payload khong hop le. Chon dung 1 mode: messageId, ids, hoac all + sourceFolder',
      );
    }

    const email = await this.getEmailFromSession();
    const affectedFolders = new Set<string>();

    const deletedCount = await this.withProvider(async () => {
      if (hasSingle && dto.messageId) {
        const decoded = Buffer.from(dto.messageId, 'base64').toString('utf8');
        const [rawFolder] = decoded.split(':');
        const folder = resolveFolderId(rawFolder, rawFolder);
        if (folder) affectedFolders.add(folder);
        return this.provider.permanentlyDeleteMessages([dto.messageId]);
      }

      if (hasMany && dto.ids) {
        for (const id of dto.ids) {
          try {
            const decoded = Buffer.from(id, 'base64').toString('utf8');
            const [rawFolder] = decoded.split(':');
            const folder = resolveFolderId(rawFolder, rawFolder);
            if (folder) affectedFolders.add(folder);
          } catch (e) {}
        }

        if (dto.sourceFolder) {
          const sourceFolderId = this.mapFolderTypeToId(dto.sourceFolder);
          const invalidId = dto.ids.find((id) => {
            try {
              const decoded = Buffer.from(id, 'base64').toString('utf8');
              const [rawFolder] = decoded.split(':');
              return resolveFolderId(rawFolder, rawFolder) !== sourceFolderId;
            } catch (e) {
              return true;
            }
          });

          if (invalidId) {
            throw new BadRequestException(
              'Danh sach ids co mail khong thuoc sourceFolder',
            );
          }
        }

        return this.provider.permanentlyDeleteMessages(dto.ids);
      }

      const sourceFolderId = this.mapFolderTypeToId(dto.sourceFolder!);
      affectedFolders.add(sourceFolderId);
      return this.provider.permanentlyDeleteAllMessages(sourceFolderId);
    });

    if (email && this.dragonfly.enabled) {
      for (const folder of affectedFolders) {
        await this.dragonfly.del(`exchange:count:${email}:${folder}`);
      }
    }

    if (email) {
      await this.getFolderCounts();
    }

    return { success: true, deletedCount };
  }
}
