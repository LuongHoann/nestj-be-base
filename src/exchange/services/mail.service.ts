import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { EwsMailProvider } from './ews-mail.provider';
import { ImapMailProvider } from './imap-mail.provider';
import { SpamModerationService } from './spam-moderation.service';
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
  ReportJunkDto,
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
  private static readonly MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB/file

  constructor(
    private readonly ewsProvider: EwsMailProvider,
    private readonly imapProvider: ImapMailProvider,
    private readonly dragonfly: DragonflyService,
    private readonly authService: ExchangeAuthService,
    private readonly moderationService: SpamModerationService,
    @Inject(REQUEST) private readonly request: any,
  ) { }

  private async resolveMailProvider() {
    const token = this.request.cookies?.['exchange_session'];
    if (!token) {
      return this.ewsProvider as any;
    }

    const credentials = await this.authService.getCredentials(token);
    return credentials?.mailProvider === 'imap'
      ? (this.imapProvider as any)
      : (this.ewsProvider as any);
  }

  private ensureProviderMethod(provider: any, methodName: string): void {
    if (typeof provider?.[methodName] !== 'function') {
      throw new BadRequestException(
        'Tính năng này hiện chỉ hỗ trợ với kết nối EWS.',
      );
    }
  }

  private async withProvider<T>(operation: (provider: any) => Promise<T>): Promise<T> {
    const provider = await this.resolveMailProvider();

    try {
      await provider.connect();
      return await operation(provider);
    } catch (error) {
      this.logger.error(`Mail operation failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await provider.disconnect();
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

    const totalSize = attachments.reduce((acc, attachment) => {
      return acc + this.getBase64SizeInBytes(attachment.content);
    }, 0);

    if (totalSize > MailService.MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException(
        `Tổng dung lượng file đính kèm vượt quá dung lượng cho phép 25MB`,
      );
    }
  }

  async getFolderCounts(mailbox?: string) {
    const email = await this.getEmailFromSession();
    if (!email) {
      return this.withProvider((provider) => provider.getFolderCounts(mailbox));
    }

    const standardFolders = MAIL_FOLDERS.map((f) => f.id);
    const mailboxPrefix = mailbox ? `:${mailbox}` : '';
    const cacheKeys = standardFolders.map(
      (f) => `exchange:count:${email}${mailboxPrefix}:${f}`,
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

    const counts = (await this.withProvider((provider) =>
      provider.getFolderCounts(mailbox),
    )) as any;

    if (this.dragonfly.enabled) {
      const ttl = 300;
      await Promise.all(
        Object.entries(counts).map(([folder, count]) =>
          this.dragonfly.set(`exchange:count:${email}${mailboxPrefix}:${folder}`, count, ttl),
        ),
      );
    }

    const mappedCounts: Record<string, { total: number; unread: number }> = {};
    for (const [id, count] of Object.entries(counts)) {
      const type = this.mapIdToFolderType(id);
      mappedCounts[type] = count as any;
    }

    return mappedCounts;
  }

  async getFolders() {
    return this.withProvider((provider) => provider.getFolders());
  }

  async getMessages(
    folderType: string,
    page: number = 1,
    pageSize: number = 20,
    mailbox?: string,
  ) {
    const folderId = this.mapFolderTypeToId(folderType);
    return this.withProvider((provider) =>
      provider.getMessages(folderId, page, pageSize, mailbox),
    );
  }

  async getMessage(id: string) {
    const message = await this.withProvider((provider) => provider.getMessage(id));

    try {
      const email = await this.getEmailFromSession();
      if (email && this.dragonfly.enabled) {
        // Extract folder from ID
        const decoded = Buffer.from(id, 'base64').toString('utf8');
        const parts = decoded.split('::');
        const rawFolder = parts[0];
        const folder = resolveFolderId(rawFolder, rawFolder);
        const mailbox = parts[2];
        const mailboxPrefix = mailbox ? `:${mailbox}` : '';

        const key = `exchange:count:${email}${mailboxPrefix}:${folder}`;
        const current = await this.dragonfly.get<{
          total: number;
          unread: number;
        }>(key) as any;

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
    return this.withProvider((provider) => {
      this.ensureProviderMethod(provider, 'downloadAttachment');
      return provider.downloadAttachment(messageId, index);
    });
  }

  async sendMessage(dto: SendMailDto) {
    this.validateAttachmentsSize(dto.attachments);
    const result = await this.withProvider((provider) =>
      provider.sendMessage(dto),
    );

    // Xóa cache song song (fire-and-forget) để không block response trả về client
    const email = await this.getEmailFromSession();
    if (email && this.dragonfly.enabled) {
      const mailboxPrefix = dto.mailbox ? `:${dto.mailbox}` : '';
      Promise.all([
        this.dragonfly.del(`exchange:count:${email}${mailboxPrefix}:Sent Items`),
        this.dragonfly.del(`exchange:count:${email}${mailboxPrefix}:INBOX`),
      ]).catch(() => {}); // Bỏ qua lỗi cache, không ảnh hưởng kết quả gửi mail
    }

    return result;
  }

  async saveDraft(dto: SaveDraftDto) {
    this.validateAttachmentsSize(dto.attachments);
    const result = await this.withProvider((provider) => provider.saveDraft(dto));
    const email = await this.getEmailFromSession();
    if (email && this.dragonfly.enabled) {
      const mailboxPrefix = dto.mailbox ? `:${dto.mailbox}` : '';
      // Dọn cache thư mục Nháp (Drafts)
      await this.dragonfly.del(`exchange:count:${email}${mailboxPrefix}:Drafts`);
    }

    return result;
  }

  async searchMessages(
    query: string,
    page: number = 1,
    pageSize: number = 20,
    folder: string = 'inbox',
    mailbox?: string,
  ) {
    return this.withProvider((provider) =>
      provider.search(query, page, pageSize, folder, mailbox),
    );
  }

  async moveMessage(messageId: string, targetFolderType: string) {
    const targetFolderId = this.mapFolderTypeToId(
      targetFolderType,
      targetFolderType,
    );
    return this.withProvider((provider) =>
      provider.moveMessage(messageId, targetFolderId),
    );
  }

  async markAsRead(dto: MarkReadDto) {
    const email = await this.getEmailFromSession();

    await this.withProvider(async (provider) => {
      if (dto.all && dto.folder) {
        const folderId = this.mapFolderTypeToId(dto.folder);
        await provider.markAllMessages(folderId, dto.isRead, dto.mailbox);

        if (email && this.dragonfly.enabled) {
          const mailboxPrefix = dto.mailbox ? `:${dto.mailbox}` : '';
          const key = `exchange:count:${email}${mailboxPrefix}:${folderId}`;
          await this.dragonfly.del(key);
        }
      } else if (dto.ids && dto.ids.length > 0) {
        await provider.markMessages(dto.ids, dto.isRead);

        if (email && this.dragonfly.enabled) {
          for (const id of dto.ids) {
            try {
              const decoded = Buffer.from(id, 'base64').toString('utf8');
              const parts = decoded.split('::');
              const rawFolder = parts[0];
              const mailbox = parts[2];
              const folder = resolveFolderId(rawFolder, rawFolder);
              if (folder) {
                const mailboxPrefix = mailbox ? `:${mailbox}` : '';
                await this.dragonfly.del(`exchange:count:${email}${mailboxPrefix}:${folder}`);
              }
            } catch (e) {}
          }
        }
      }
    });

    if (email) {
      await this.getFolderCounts(dto.mailbox);
    }

    return { success: true };
  }

  async moveMessagesBatch(dto: MoveBatchDto) {
    const email = await this.getEmailFromSession();
    const targetFolderId = this.mapFolderTypeToId(
      dto.targetFolder,
      dto.targetFolder,
    );

    await this.withProvider(async (provider) => {
      if (dto.all && dto.sourceFolder) {
        const sourceFolderId = this.mapFolderTypeToId(dto.sourceFolder);
        await provider.moveAllMessages(sourceFolderId, targetFolderId, dto.mailbox);

        if (email && this.dragonfly.enabled) {
          const mailboxPrefix = dto.mailbox ? `:${dto.mailbox}` : '';
          await this.dragonfly.del(`exchange:count:${email}${mailboxPrefix}:${sourceFolderId}`);
          await this.dragonfly.del(`exchange:count:${email}${mailboxPrefix}:${targetFolderId}`);
        }
      } else if (dto.ids && dto.ids.length > 0) {
        await provider.moveMessagesBatch(dto.ids, targetFolderId);

        if (email && this.dragonfly.enabled) {
          const folders = new Map<string, string | undefined>();
          folders.set(targetFolderId, dto.mailbox);

          for (const id of dto.ids) {
            try {
              const decoded = Buffer.from(id, 'base64').toString('utf8');
              const parts = decoded.split('::');
              const rawFolder = parts[0];
              const mailbox = parts[2];
              const folder = resolveFolderId(rawFolder, rawFolder);
              if (folder) folders.set(folder, mailbox);
            } catch (e) {}
          }

          for (const [folder, mailbox] of folders.entries()) {
            const mailboxPrefix = mailbox ? `:${mailbox}` : '';
            const key = `exchange:count:${email}${mailboxPrefix}:${folder}`;
            await this.dragonfly.del(key);
          }
        }
      }
    });

    if (email) {
      await this.getFolderCounts(dto.mailbox);
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
        'Payload không hợp lệ. Chọn đúng 1 mode: messageId, ids, hoặc all + sourceFolder',
      );
    }

    const email = await this.getEmailFromSession();
    const affectedFolders = new Map<string, string | undefined>();

    const deletedCount = await this.withProvider(async (provider) => {
      if (hasSingle && dto.messageId) {
        const decoded = Buffer.from(dto.messageId, 'base64').toString('utf8');
        const parts = decoded.split('::');
        const rawFolder = parts[0];
        const mailbox = parts[2];
        const folder = resolveFolderId(rawFolder, rawFolder);
        if (folder) affectedFolders.set(folder, mailbox);
        return provider.permanentlyDeleteMessages([dto.messageId]);
      }

      if (hasMany && dto.ids) {
        for (const id of dto.ids) {
          try {
            const decoded = Buffer.from(id, 'base64').toString('utf8');
            const parts = decoded.split('::');
            const rawFolder = parts[0];
            const mailbox = parts[2];
            const folder = resolveFolderId(rawFolder, rawFolder);
            if (folder) affectedFolders.set(folder, mailbox);
          } catch (e) {}
        }

        if (dto.sourceFolder) {
          const sourceFolderId = this.mapFolderTypeToId(dto.sourceFolder);
          const invalidId = dto.ids.find((id) => {
            try {
              const decoded = Buffer.from(id, 'base64').toString('utf8');
              const parts = decoded.split('::');
              const rawFolder = parts[0];
              return resolveFolderId(rawFolder, rawFolder) !== sourceFolderId;
            } catch (e) {
              return true;
            }
          });

          if (invalidId) {
            throw new BadRequestException(
              'Danh sách ids có mail không thuộc sourceFolder',
            );
          }
        }

        return provider.permanentlyDeleteMessages(dto.ids);
      }

      const sourceFolderId = this.mapFolderTypeToId(dto.sourceFolder!);
      affectedFolders.set(sourceFolderId, dto.mailbox);
      return provider.permanentlyDeleteAllMessages(sourceFolderId, dto.mailbox);
    });

    if (email && this.dragonfly.enabled) {
      for (const [folder, mailbox] of affectedFolders.entries()) {
        const mailboxPrefix = mailbox ? `:${mailbox}` : '';
        await this.dragonfly.del(`exchange:count:${email}${mailboxPrefix}:${folder}`);
      }
    }

    if (email) {
      await this.getFolderCounts(dto.mailbox);
    }

    return { success: true, deletedCount };
  }

  async markStar(dto: StarMailDto) {
    const email = await this.getEmailFromSession();

    await this.withProvider(async (provider) => {
      if (dto.all && dto.folder) {
        const folderId = this.mapFolderTypeToId(dto.folder);
        this.ensureProviderMethod(provider, 'markAllMessagesStar');
        await provider.markAllMessagesStar(folderId, true, dto.mailbox);

        if (email && this.dragonfly.enabled) {
          const mailboxPrefix = dto.mailbox ? `:${dto.mailbox}` : '';
          const key = `exchange:count:${email}${mailboxPrefix}:${folderId}`;
          await this.dragonfly.del(key);
        }
      } else if (dto.ids && dto.ids.length > 0) {
        this.ensureProviderMethod(provider, 'markMessagesStar');
        await provider.markMessagesStar(dto.ids, true);

        if (email && this.dragonfly.enabled) {
          const folders = new Map<string, string | undefined>();
          for (const id of dto.ids) {
            try {
              const decoded = Buffer.from(id, 'base64').toString('utf8');
              const parts = decoded.split('::');
              const rawFolder = parts[0];
              const mailbox = parts[2];
              const folder = resolveFolderId(rawFolder, rawFolder);
              if (folder) folders.set(folder, mailbox);
            } catch (e) {}
          }

          for (const [folder, mailbox] of folders.entries()) {
            const mailboxPrefix = mailbox ? `:${mailbox}` : '';
            const key = `exchange:count:${email}${mailboxPrefix}:${folder}`;
            await this.dragonfly.del(key);
          }
        }
      } else {
        throw new BadRequestException(
          'Payload không hợp lệ. Cần ids hoặc all + folder',
        );
      }
    });

    if (email) {
      await this.getFolderCounts(dto.mailbox);
    }

    return { success: true };
  }

  async unmarkStar(dto: StarMailDto) {
    const email = await this.getEmailFromSession();

    await this.withProvider(async (provider) => {
      if (dto.all && dto.folder) {
        const folderId = this.mapFolderTypeToId(dto.folder);
        this.ensureProviderMethod(provider, 'markAllMessagesStar');
        await provider.markAllMessagesStar(folderId, false, dto.mailbox);

        if (email && this.dragonfly.enabled) {
          const mailboxPrefix = dto.mailbox ? `:${dto.mailbox}` : '';
          const key = `exchange:count:${email}${mailboxPrefix}:${folderId}`;
          await this.dragonfly.del(key);
        }
      } else if (dto.ids && dto.ids.length > 0) {
        this.ensureProviderMethod(provider, 'markMessagesStar');
        await provider.markMessagesStar(dto.ids, false);

        if (email && this.dragonfly.enabled) {
          const folders = new Map<string, string | undefined>();
          for (const id of dto.ids) {
            try {
              const decoded = Buffer.from(id, 'base64').toString('utf8');
              const parts = decoded.split('::');
              const rawFolder = parts[0];
              const mailbox = parts[2];
              const folder = resolveFolderId(rawFolder, rawFolder);
              if (folder) folders.set(folder, mailbox);
            } catch (e) {}
          }

          for (const [folder, mailbox] of folders.entries()) {
            const mailboxPrefix = mailbox ? `:${mailbox}` : '';
            const key = `exchange:count:${email}${mailboxPrefix}:${folder}`;
            await this.dragonfly.del(key);
          }
        }
      } else {
        throw new BadRequestException(
          'Payload không hợp lệ. Cần ids hoặc all + folder',
        );
      }
    });

    if (email) {
      await this.getFolderCounts(dto.mailbox);
    }

    return { success: true };
  }

  async replyMessage(dto: ReplyMailDto) {
    this.validateAttachmentsSize(dto.attachments);
    const result = await this.withProvider((provider) => {
      this.ensureProviderMethod(provider, 'replyMessage');
      return provider.replyMessage({
        messageId: dto.messageId,
        html: dto.html,
        text: dto.text,
        replyAll: dto.replyAll,
        attachments: dto.attachments?.map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          content: att.content,
        })),
      });
    });

    const email = await this.getEmailFromSession();
    if (email && this.dragonfly.enabled) {
      const mailboxPrefix = dto.mailbox ? `:${dto.mailbox}` : '';
      this.dragonfly.del(`exchange:count:${email}${mailboxPrefix}:Sent Items`).catch(() => {});
    }

    return result;
  }

  async forwardMessage(dto: ForwardMailDto) {
    this.validateAttachmentsSize(dto.attachments);
    const result = await this.withProvider((provider) => {
      this.ensureProviderMethod(provider, 'forwardMessage');
      return provider.forwardMessage({
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
      });
    });

    const email = await this.getEmailFromSession();
    if (email && this.dragonfly.enabled) {
      const mailboxPrefix = dto.mailbox ? `:${dto.mailbox}` : '';
      this.dragonfly.del(`exchange:count:${email}${mailboxPrefix}:Sent Items`).catch(() => {});
    }

    return result;
  }

  async reportJunk(dto: ReportJunkDto) {
    const email = await this.getEmailFromSession();

    await this.withProvider(async (provider) => {
      // 1. Thực hiện xử lý trên Exchange via Provider
      await provider.markAsJunk(dto.ids, dto.isJunk, true);

      // 2. Ghi log báo cáo spam nếu hành động là "đánh dấu thư rác"
      if (dto.isJunk && email && dto.ids && dto.ids.length > 0) {
        for (const messageId of dto.ids) {
          try {
            // Lấy thông tin người gửi để ghi log
            const msg = await provider.getMessage(messageId);
            if (msg && msg.from) {
              await this.moderationService.reportSpam(
                email,
                msg.from.email,
                messageId,
              );
            }
          } catch (e) {
            this.logger.warn(`Failed to log spam report for ${messageId}: ${e.message}`);
          }
        }
      }

      // 3. Xử lý Cache
      if (email && this.dragonfly.enabled) {
        const folders = new Map<string, string | undefined>();
        folders.set(this.mapFolderTypeToId('inbox'), dto.mailbox);
        folders.set(this.mapFolderTypeToId('spam'), dto.mailbox);

        for (const [folder, mailbox] of folders.entries()) {
          const mailboxPrefix = mailbox ? `:${mailbox}` : '';
          const key = `exchange:count:${email}${mailboxPrefix}:${folder}`;
          await this.dragonfly.del(key);
        }
      }
    });

    if (email) {
      await this.getFolderCounts(dto.mailbox);
    }

    return { success: true };
  }

  async getConversationMessages(messageId: string, maxItems: number = 50) {
    return this.withProvider((provider) => {
      this.ensureProviderMethod(provider, 'getConversationMessages');
      return provider.getConversationMessages(messageId, maxItems);
    });
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
    mailbox?: string;
  }) {
    return this.withProvider((provider) => {
      this.ensureProviderMethod(provider, 'createEvent');
      return provider.createEvent(payload);
    });
  }

  async getEvents(startDate: string, endDate: string) {
    return this.withProvider((provider) => {
      this.ensureProviderMethod(provider, 'getEvents');
      return provider.getEvents(startDate, endDate);
    });
  }

  async getEventDetails(eventId: string) {
    return this.withProvider((provider) => {
      this.ensureProviderMethod(provider, 'getEventDetails');
      return provider.getEventDetails(eventId);
    });
  }

  async updateEvent(eventId: string, payload: any) {
    return this.withProvider((provider) => {
      this.ensureProviderMethod(provider, 'updateEvent');
      return provider.updateEvent(eventId, payload);
    });
  }

  async deleteEvent(eventId: string) {
    return this.withProvider((provider) => {
      this.ensureProviderMethod(provider, 'deleteEvent');
      return provider.deleteEvent(eventId);
    });
  }

  async getActiveReminders() {
    return this.withProvider((provider) => {
      this.ensureProviderMethod(provider, 'getActiveReminders');
      return provider.getActiveReminders();
    });
  }

  async dismissReminder(eventId: string) {
    return this.withProvider((provider) => {
      this.ensureProviderMethod(provider, 'dismissReminder');
      return provider.dismissReminder(eventId);
    });
  }
}
