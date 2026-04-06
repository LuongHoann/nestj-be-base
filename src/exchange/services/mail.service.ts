import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { parse } from 'path';
import { EwsMailProvider } from './ews-mail.provider';
import { MailMessage } from '../interfaces/mail-provider.interface';
import {
  SendMailDto,
  SaveDraftDto,
  MarkReadDto,
  MoveBatchDto,
  PermanentDeleteMailDto,
  StarMailDto,
  ReplyMailDto,
  ForwardMailDto,
} from '../dto/exchange.dto';

import { DragonflyService } from '../../common/cache/dragonfly.service';
import { ExchangeAuthService } from './exchange-auth.service';
import { LibreOfficeConverterService } from './libreoffice-converter.service';
import {
  DEFAULT_FOLDER_ID,
  MAIL_FOLDERS,
  resolveFolderId,
  resolveFolderType,
} from '../constants/mail-folders.constant';

@Injectable({ scope: Scope.REQUEST })
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private static readonly MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB/file

  constructor(
    private readonly provider: EwsMailProvider,
    private readonly dragonfly: DragonflyService,
    private readonly authService: ExchangeAuthService,
    private readonly libreOfficeConverter: LibreOfficeConverterService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private async withProvider<T>(operation: () => Promise<T>): Promise<T> {
    try {
      await this.provider.connect();
      return await operation();
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Mail operation failed: ${normalizedError.message}`,
        normalizedError.stack,
      );
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

  private getBase64SizeInBytes(base64Content: string): number {
    if (!base64Content) return 0;
    const normalized = base64Content.includes(',')
      ? base64Content.split(',').pop() || ''
      : base64Content;
    const sanitized = normalized.replace(/\s/g, '');
    const padding = sanitized.endsWith('==')
      ? 2
      : sanitized.endsWith('=')
        ? 1
        : 0;
    return Math.floor((sanitized.length * 3) / 4) - padding;
  }

  private validateAttachmentsSize(
    attachments?: Array<{ filename: string; content: string }>,
  ): void {
    if (!attachments?.length) return;

    for (const attachment of attachments) {
      const size = this.getBase64SizeInBytes(attachment.content);
      if (size > MailService.MAX_ATTACHMENT_SIZE_BYTES) {
        throw new BadRequestException(
          `File "${attachment.filename}" vuot qua gioi han 25MB`,
        );
      }
    }
  }

  async getFolderCounts() {
    const email = await this.getEmailFromSession();
    if (!email) {
      return this.withProvider(() => this.provider.getFolderCounts());
    }

    const standardFolders = MAIL_FOLDERS.map((f) => f.id);
    const cacheKeys = standardFolders.map(
      (f) => `exchange:count:${email}:${f}`,
    );

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

    const counts = await this.withProvider(() =>
      this.provider.getFolderCounts(),
    );

    if (this.dragonfly.enabled) {
      const ttl = 300;
      await Promise.all(
        Object.entries(counts).map(([folder, count]) =>
          this.dragonfly.set(`exchange:count:${email}:${folder}`, count, ttl),
        ),
      );
    }

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

  async getMessages(
    folderType: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
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
        const decoded = Buffer.from(id, 'base64').toString('utf8');
        const [rawFolder] = decoded.split(':');
        const folder = resolveFolderId(rawFolder, rawFolder);

        const key = `exchange:count:${email}:${folder}`;
        const current = await this.dragonfly.get<{
          total: number;
          unread: number;
        }>(key);

        if (current && current.unread > 0) {
          await this.dragonfly.del(key);
        }
      }
    } catch (e) {
      // ignore cache errors
    }

    return message;
  }

  async downloadAttachment(messageId: string, index: number) {
    return this.withProvider(() =>
      this.provider.downloadAttachment(messageId, index),
    );
  }

  async previewAttachmentAsPdf(messageId: string, index: number) {
    const attachment = await this.downloadAttachment(messageId, index);
    const extension = parse(attachment.filename || '').ext.toLowerCase();

    if (!['.ppt', '.pptx'].includes(extension)) {
      throw new BadRequestException(
        'Chi ho tro convert PDF preview cho file PowerPoint',
      );
    }

    try {
      const pdfContent = await this.libreOfficeConverter.convertToPdf(
        attachment.filename || `attachment${extension}`,
        attachment.content,
      );

      return {
        filename: `${parse(attachment.filename || 'preview').name}.pdf`,
        contentType: 'application/pdf',
        size: pdfContent.length,
        content: pdfContent,
      };
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Attachment PDF preview failed: ${normalizedError.message}`,
        normalizedError.stack,
      );
      throw new BadRequestException(
        `Khong the convert PowerPoint sang PDF: ${normalizedError.message}`,
      );
    }
  }

  async sendMessage(dto: SendMailDto) {
    this.validateAttachmentsSize(dto.attachments);
    const result = await this.withProvider(() =>
      this.provider.sendMessage(dto),
    );

    const email = await this.getEmailFromSession();
    if (email && this.dragonfly.enabled) {
      await this.dragonfly.del(`exchange:count:${email}:Sent Items`);
      await this.dragonfly.del(`exchange:count:${email}:INBOX`);
    }

    return result;
  }

  async saveDraft(dto: SaveDraftDto) {
    this.validateAttachmentsSize(dto.attachments);
    const result = await this.withProvider(() => this.provider.saveDraft(dto));
    const email = await this.getEmailFromSession();
    if (email && this.dragonfly.enabled) {
      // Dọn cache thư mục Nháp (Drafts)
      await this.dragonfly.del(`exchange:count:${email}:Drafts`);
    }

    return result;
  }

  async searchMessages(
    query: string,
    page: number = 1,
    pageSize: number = 20,
    folder: string = 'inbox',
  ) {
    return this.withProvider(() =>
      this.provider.search(query, page, pageSize, folder),
    );
  }

  async moveMessage(messageId: string, targetFolderType: string) {
    const targetFolderId = this.mapFolderTypeToId(
      targetFolderType,
      targetFolderType,
    );
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

        if (email && this.dragonfly.enabled) {
          const key = `exchange:count:${email}:${folderId}`;
          await this.dragonfly.del(key);
        }
      } else if (dto.ids && dto.ids.length > 0) {
        await this.provider.markMessages(dto.ids, dto.isRead);

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

        if (email && this.dragonfly.enabled) {
          await this.dragonfly.del(`exchange:count:${email}:${sourceFolderId}`);
          await this.dragonfly.del(`exchange:count:${email}:${targetFolderId}`);
        }
      } else if (dto.ids && dto.ids.length > 0) {
        await this.provider.moveMessagesBatch(dto.ids, targetFolderId);

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

    const selectedModes = [hasSingle, hasMany, hasDeleteAll].filter(
      Boolean,
    ).length;
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

  async markStar(dto: StarMailDto) {
    const email = await this.getEmailFromSession();

    await this.withProvider(async () => {
      if (dto.all && dto.folder) {
        const folderId = this.mapFolderTypeToId(dto.folder);
        await this.provider.markAllMessagesStar(folderId, true);

        if (email && this.dragonfly.enabled) {
          const key = `exchange:count:${email}:${folderId}`;
          await this.dragonfly.del(key);
        }
      } else if (dto.ids && dto.ids.length > 0) {
        await this.provider.markMessagesStar(dto.ids, true);

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
      } else {
        throw new BadRequestException(
          'Payload khong hop le. Can ids hoac all + folder',
        );
      }
    });

    if (email) {
      await this.getFolderCounts();
    }

    return { success: true };
  }

  async unmarkStar(dto: StarMailDto) {
    const email = await this.getEmailFromSession();

    await this.withProvider(async () => {
      if (dto.all && dto.folder) {
        const folderId = this.mapFolderTypeToId(dto.folder);
        await this.provider.markAllMessagesStar(folderId, false);

        if (email && this.dragonfly.enabled) {
          const key = `exchange:count:${email}:${folderId}`;
          await this.dragonfly.del(key);
        }
      } else if (dto.ids && dto.ids.length > 0) {
        await this.provider.markMessagesStar(dto.ids, false);

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
      } else {
        throw new BadRequestException(
          'Payload khong hop le. Can ids hoac all + folder',
        );
      }
    });

    if (email) {
      await this.getFolderCounts();
    }

    return { success: true };
  }

  /**
   * Trả lời một email dựa trên ID của thư gốc.
   * EWS sẽ tự động kết nối luồng hội thoại (In-Reply-To, References headers).
   */
  async replyMessage(dto: ReplyMailDto) {
    this.validateAttachmentsSize(dto.attachments);
    const result = await this.withProvider(() =>
      this.provider.replyMessage({
        messageId: dto.messageId,
        html: dto.html,
        text: dto.text,
        replyAll: dto.replyAll,
        attachments: dto.attachments?.map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          content: att.content,
        })),
      }),
    );

    // Xóa cache Sent Items để cập nhật số lượng mới
    const email = await this.getEmailFromSession();
    if (email && this.dragonfly.enabled) {
      await this.dragonfly.del(`exchange:count:${email}:Sent Items`);
    }

    return result;
  }

  /**
   * Chuyển tiếp một email đến người nhận khác.
   * EWS giữ nguyên thư, tệp đính kèm cũ được chuyển theo tự động.
   */
  async forwardMessage(dto: ForwardMailDto) {
    this.validateAttachmentsSize(dto.attachments);
    const result = await this.withProvider(() =>
      this.provider.forwardMessage({
        messageId: dto.messageId,
        to: dto.to,
        cc: dto.cc,
        bcc: dto.bcc,
        html: dto.html,
        text: dto.text,
        attachments: dto.attachments?.map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          content: att.content,
        })),
      }),
    );

    // Xóa cache Sent Items để cập nhận số lượng mới
    const email = await this.getEmailFromSession();
    if (email && this.dragonfly.enabled) {
      await this.dragonfly.del(`exchange:count:${email}:Sent Items`);
    }

    return result;
  }

  /**
   * Lấy toàn bộ email trong cùng luồng hội thoại theo messageId gốc.
   * Backend tự bind email để lấy ConversationId, sau đó tìm xuyên Inbox/Sent/Drafts.
   * @param messageId - Composite ID (base64) của email cần load thread
   * @param maxItems  - Số lượng email tối đa (mặc định 50)
   */
  async getConversationMessages(messageId: string, maxItems: number = 50) {
    return this.withProvider(() =>
      this.provider.getConversationMessages(messageId, maxItems),
    );
  }

  // ─── CALENDAR & REMINDERS ────────────────────────────────────────────────────────

  async createEvent(payload: {
    subject: string;
    body: string;
    start: string;
    end: string;
    location?: string;
    isAllDayEvent?: boolean;
    isReminderSet?: boolean;
    reminderMinutesBeforeStart?: number;
  }) {
    return this.withProvider(() => this.provider.createEvent(payload));
  }

  async getEvents(startDate: string, endDate: string) {
    return this.withProvider(() => this.provider.getEvents(startDate, endDate));
  }

  async getEventDetails(eventId: string) {
    return this.withProvider(() => this.provider.getEventDetails(eventId));
  }

  async updateEvent(eventId: string, payload: any) {
    return this.withProvider(() => this.provider.updateEvent(eventId, payload));
  }

  async deleteEvent(eventId: string) {
    return this.withProvider(() => this.provider.deleteEvent(eventId));
  }

  async getActiveReminders() {
    return this.withProvider(() => this.provider.getActiveReminders());
  }

  async dismissReminder(eventId: string) {
    return this.withProvider(() => this.provider.dismissReminder(eventId));
  }
}
