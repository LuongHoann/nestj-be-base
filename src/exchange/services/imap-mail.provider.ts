import {
  Injectable,
  Scope,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';
import * as nodemailer from 'nodemailer';
import * as mailparser from 'mailparser';
import {
  IMailProvider,
  MailFolder,
  MailMessage,
  SendMailOptions,
} from '../interfaces/mail-provider.interface';
import { ExchangeAuthService } from './exchange-auth.service';

@Injectable({ scope: Scope.REQUEST })
export class ImapMailProvider implements IMailProvider {
  private readonly logger = new Logger(ImapMailProvider.name);
  private client: ImapFlow;
  private transporter: nodemailer.Transporter;
  private credentials: { email: string; password: string };
  private sessionToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: ExchangeAuthService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getImapConfig() {
    const host = this.configService.get<string>(
      'IMAP_HOST',
      'outlook.office365.com',
    );
    const port = this.configService.get<number>('IMAP_PORT', 993);
    const secure = this.configService.get<boolean>('IMAP_SECURE', true);

    return {
      host,
      port,
      secure,
      auth: {
        user: this.credentials.email,
        pass: this.credentials.password,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      },
      logger: false,
    };
  }

  private getSmtpConfig() {
    const host = this.configService.get<string>(
      'SMTP_HOST',
      'smtp.office365.com',
    );
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const isSecure = port === 465;

    return {
      host,
      port,
      secure: isSecure,
      auth: {
        user: this.credentials.email,
        pass: this.credentials.password,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      },
    };
  }

  async connect(): Promise<void> {
    // Lấy session token từ cookie
    this.sessionToken = this.request.cookies?.['exchange_session'];

    if (!this.sessionToken) {
      throw new UnauthorizedException(
        'No session token provided. Please login first.',
      );
    }

    // Lấy credentials từ session
    const creds = await this.authService.getCredentials(this.sessionToken);

    if (!creds) {
      throw new UnauthorizedException(
        'Session expired or invalid. Please login again.',
      );
    }

    this.credentials = creds;

    // Kết nối IMAP
    this.client = new ImapFlow(this.getImapConfig() as any);
    await this.client.connect();
    this.logger.log(`IMAP connected for ${this.credentials.email}`);

    // Khởi tạo SMTP transporter
    this.transporter = nodemailer.createTransport(this.getSmtpConfig() as any);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
        this.logger.log('IMAP disconnected');
      } catch (error) {
        this.logger.warn(`Error disconnecting IMAP: ${error.message}`);
      }
    }
  }

  private encodeId(folder: string, uid: string): string {
    return Buffer.from(`${folder}:${uid}`).toString('base64');
  }

  private decodeId(id: string): { folder: string; uid: string } {
    const decoded = Buffer.from(id, 'base64').toString('utf8');
    const [folder, uid] = decoded.split(':');
    return { folder, uid };
  }

  async getFolders(): Promise<MailFolder[]> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    try {
      const list = await this.client.list();

      // Map standard folders
      const folderMap: Record<string, string> = {
        INBOX: 'Hộp thư đến',
        'Sent Items': 'Đã gửi',
        Drafts: 'Thư nháp',
        'Deleted Items': 'Thùng rác',
        'Junk Email': 'Thư rác',
      };

      const standardFolders = [
        'INBOX',
        'Sent Items',
        'Drafts',
        'Deleted Items',
      ];
      const folders: MailFolder[] = [];

      for (const folderName of standardFolders) {
        const exists = list.some(
          (f) =>
            f.path === folderName ||
            f.path.toLowerCase() === folderName.toLowerCase(),
        );

        if (exists) {
          folders.push({
            id: folderName,
            name: folderMap[folderName] || folderName,
          });
        }
      }

      return folders;
    } catch (error) {
      this.logger.error(`Error fetching folders: ${error.message}`);
      throw error;
    }
  }

  async getMessages(
    folderId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const lock = await this.client.getMailboxLock(folderId);
    try {
      const status = await this.client.status(folderId, { messages: true });
      const total = status.messages || 0;

      if (total === 0) {
        return { items: [], total: 0 };
      }

      // Tính toán range cho pagination (newest first)
      const to = Math.max(1, total - (page - 1) * limit);
      const from = Math.max(1, to - limit + 1);

      if (to < 1) {
        return { items: [], total };
      }

      const seqRange = `${from}:${to}`;

      // Fetch messages
      const messages: any[] = [];
      for await (const msg of this.client.fetch(seqRange, {
        envelope: true,
        internalDate: true,
        bodyStructure: true,
        flags: true,
        uid: true,
      })) {
        messages.push(msg);
      }

      // Reverse để hiển thị mới nhất trước
      messages.reverse();

      const items = messages.map((msg) => ({
        id: this.encodeId(folderId, msg.uid.toString()),
        subject: msg.envelope.subject || '(No Subject)',
        from: msg.envelope.from
          ? this.mapAddress(msg.envelope.from[0])
          : { name: '', email: '' },
        receivedAt: msg.internalDate,
        isRead: msg.flags.has('\\Seen'),
        hasAttachments: this.checkAttachments(msg.bodyStructure),
        preview: '', // Skip preview for performance
      }));

      return { items, total };
    } catch (error) {
      this.logger.error(
        `Error fetching messages from ${folderId}: ${error.message}`,
      );
      throw error;
    } finally {
      lock.release();
    }
  }

  private mapAddress(addr: any): { name: string; email: string } {
    return {
      name: addr.name || '',
      email: addr.address || '',
    };
  }

  private checkAttachments(struct: any): boolean {
    if (!struct) return false;

    if (struct.childNodes) {
      return struct.childNodes.some(
        (node: any) =>
          node.disposition === 'attachment' ||
          (node.parameters && node.parameters.name),
      );
    }

    return false;
  }

  async getMessage(id: string): Promise<MailMessage> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const { folder, uid } = this.decodeId(id);
    const lock = await this.client.getMailboxLock(folder);

    try {
      // Fetch message
      const msg = await this.client.fetchOne(
        uid,
        { source: true, flags: true, uid: true },
        { uid: true },
      );

      if (!msg) {
        throw new Error('Message not found');
      }

      // Mark as read if not already
      if (msg.flags && !msg.flags.has('\\Seen')) {
        await this.client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      }

      if (!msg.source) {
        throw new Error('Message source not available');
      }

      // Parse email
      const parsed: any = await mailparser.simpleParser(msg.source);

      return {
        id: id,
        subject: parsed.subject || '(No Subject)',
        from: parsed.from?.value?.[0]
          ? {
              name: parsed.from.value[0].name || '',
              email: parsed.from.value[0].address || '',
            }
          : { name: '', email: '' },
        to: this.parseAddressList(parsed.to),
        cc: this.parseAddressList(parsed.cc),
        receivedAt: parsed.date || new Date(),
        body: parsed.html || parsed.textAsHtml || parsed.text || '',
        isHtml: !!parsed.html,
        hasAttachments: parsed.attachments && parsed.attachments.length > 0,
        isRead: true,
        preview: parsed.text ? parsed.text.substring(0, 100) : '',
      };
    } catch (error) {
      this.logger.error(`Error fetching message ${id}: ${error.message}`);
      throw error;
    } finally {
      lock.release();
    }
  }

  private parseAddressList(
    addressData: any,
  ): { name: string; email: string }[] {
    if (!addressData) return [];

    if (Array.isArray(addressData)) {
      return addressData.map((addr: any) => ({
        name: addr.name || '',
        email: addr.address || '',
      }));
    }

    if (addressData.value && Array.isArray(addressData.value)) {
      return addressData.value.map((addr: any) => ({
        name: addr.name || '',
        email: addr.address || '',
      }));
    }

    return [];
  }

  async sendMessage(
    options: SendMailOptions,
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.transporter) {
      throw new Error('Transporter not initialized. Call connect() first.');
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.credentials.email,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        html: options.body,
      });

      this.logger.log(`Email sent successfully. MessageId: ${info.messageId}`);

      return {
        success: !!info.messageId,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`);
      throw error;
    }
  }

  async search(
    query: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const folderId = 'INBOX';
    const lock = await this.client.getMailboxLock(folderId);

    try {
      // IMAP SEARCH
      const searchCriteria = {
        or: [
          { header: { key: 'subject', value: query } },
          { header: { key: 'from', value: query } },
          { body: query },
        ],
      };

      const uids = await this.client.search(searchCriteria, { uid: true });

      if (!uids || uids.length === 0) {
        return { items: [], total: 0 };
      }

      const total = uids.length;

      // Pagination (newest first)
      uids.reverse();
      const slicedUids = uids.slice((page - 1) * limit, page * limit);

      if (slicedUids.length === 0) {
        return { items: [], total };
      }

      // Fetch messages
      const messages: any[] = [];
      const uidSet = slicedUids.join(',');

      for await (const msg of this.client.fetch(
        uidSet,
        { envelope: true, internalDate: true, uid: true, flags: true },
        { uid: true },
      )) {
        messages.push(msg);
      }

      const items = messages.map((msg) => ({
        id: this.encodeId(folderId, msg.uid.toString()),
        subject: msg.envelope.subject || '(No Subject)',
        from: msg.envelope.from
          ? this.mapAddress(msg.envelope.from[0])
          : { name: '', email: '' },
        receivedAt: msg.internalDate,
        isRead: msg.flags.has('\\Seen'),
        hasAttachments: false, // Skip for search results performance
      }));

      // Sort by date descending
      items.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

      return { items, total };
    } catch (error) {
      this.logger.error(`Error searching messages: ${error.message}`);
      throw error;
    } finally {
      lock.release();
    }
  }
}
