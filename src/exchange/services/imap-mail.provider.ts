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
import { safeStringify } from '../utils/json.helper';

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
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);
    return {
      host,
      port,
      secure: false,
      requireTLS: true, // ⬅️ ĐỔI: Không bắt buộc TLS
      auth: {
        user: this.credentials.email,
        pass: this.credentials.password,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      },
      debug: true,
      logger: true,
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
    try {
      await this.transporter.verify();
      this.logger.log(`SMTP verified for ${this.credentials.email}`);
    } catch (error) {
      this.logger.error(`SMTP verification failed: ${error.message}`);
      throw error;
    }
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
        Spam: 'Thùng rác',
        'Junk Email': 'Thư rác',
      };

      const standardFolders = ['INBOX', 'Sent Items', 'Drafts', 'Spam'];
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

  async getFolderCounts(): Promise<Record<string, { total: number; unread: number }>> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const standardFolders = ['INBOX', 'Sent Items', 'Drafts', 'Spam', 'Junk Email'];
    const counts: Record<string, { total: number; unread: number }> = {};

    for (const folder of standardFolders) {
      try {
        const lock = await this.client.getMailboxLock(folder);
        try {
          const status = await this.client.status(folder, { messages: true, unseen: true });
          counts[folder] = {
            total: status.messages || 0,
            unread: status.unseen || 0,
          };
        } finally {
          lock.release();
        }
      } catch (error) {
        // If folder doesn't exist or error, just set to 0
        counts[folder] = { total: 0, unread: 0 };
      }
    }
    
    return counts;
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
        source: {
          maxLength: 1024,
        },
      })) {
        messages.push(msg);
      }

      // Reverse để hiển thị mới nhất trước
      messages.reverse();

      const items = await Promise.all(
        messages.map(async (msg) => {
          let preview = '';
          if (msg.source) {
            try {
              const parsed = await mailparser.simpleParser(msg.source);
              if (parsed.text) {
                preview = parsed.text;
              } else if (parsed.html) {
                preview = parsed.html.replace(/<[^>]*>?/gm, ' ');
              }

              if (preview) {
                preview = preview.replace(/\s+/g, ' ').trim().substring(0, 200);
              }
            } catch (error) {
              // Ignore
            }
          }

          return {
            id: this.encodeId(folderId, msg.uid.toString()),
            subject: msg.envelope.subject || '(No Subject)',
            from: msg.envelope.from
              ? this.mapAddress(msg.envelope.from[0])
              : { name: '', email: '' },
            receivedAt: msg.internalDate,
            isRead: msg.flags.has('\\Seen'),
            hasAttachments: this.checkAttachments(msg.bodyStructure),
            preview,
          };
        }),
      );

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

    if (!this.client) {
      throw new Error('IMAP client not connected. Call connect() first.');
    }

    try {
      // Build attachments array if provided
      const attachments = options.attachments?.map((att) => ({
        filename: att.filename,
        contentType: att.contentType,
        content: Buffer.from(att.content, 'base64'),
      }));

      const mailOptions = {
        from: this.credentials.email,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments,
      };

      // Send email via SMTP
      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully. MessageId: ${info.messageId}`);

      // Append to Sent Items folder using IMAP
      this.appendToSentFolder(mailOptions,info.messageId)
        .then(() => {
          this.logger.log(`Email appended to Sent Items folder`);
        })
        .catch((err) => {
          this.logger.warn(
            `Failed to append email to Sent Items: ${err.message}`,
          );
        });

      return {
        success: !!info.messageId,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`);
      throw error;
    }
  }

    private buildRFC822Message(mailOptions: any, messageId: string): string {
    const lines: string[] = [];

    // Headers
    lines.push(`Message-ID: ${messageId}`);
    lines.push(`Date: ${new Date().toUTCString()}`);
    lines.push(`From: ${mailOptions.from}`);
    
    if (mailOptions.to) {
      const toAddresses = Array.isArray(mailOptions.to)
        ? mailOptions.to.join(', ')
        : mailOptions.to;
      lines.push(`To: ${toAddresses}`);
    }

    if (mailOptions.cc) {
      const ccAddresses = Array.isArray(mailOptions.cc)
        ? mailOptions.cc.join(', ')
        : mailOptions.cc;
      lines.push(`Cc: ${ccAddresses}`);
    }

    if (mailOptions.replyTo) {
      lines.push(`Reply-To: ${mailOptions.replyTo}`);
    }

    lines.push(`Subject: ${mailOptions.subject || '(No Subject)'}`);
    lines.push(`MIME-Version: 1.0`);

    // Handle multipart message (HTML + text or with attachments)
    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      lines.push('');
      
      // Text/HTML part
      lines.push(`--${boundary}`);
      if (mailOptions.html) {
        lines.push(`Content-Type: text/html; charset=utf-8`);
        lines.push(`Content-Transfer-Encoding: quoted-printable`);
        lines.push('');
        lines.push(mailOptions.html);
      } else if (mailOptions.text) {
        lines.push(`Content-Type: text/plain; charset=utf-8`);
        lines.push(`Content-Transfer-Encoding: quoted-printable`);
        lines.push('');
        lines.push(mailOptions.text);
      }

      // Attachments
      for (const att of mailOptions.attachments) {
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${att.contentType || 'application/octet-stream'}`);
        lines.push(`Content-Transfer-Encoding: base64`);
        lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        lines.push('');
        lines.push(att.content.toString('base64'));
      }

      lines.push(`--${boundary}--`);
    } else if (mailOptions.html) {
      // HTML only
      lines.push(`Content-Type: text/html; charset=utf-8`);
      lines.push(`Content-Transfer-Encoding: quoted-printable`);
      lines.push('');
      lines.push(mailOptions.html);
    } else {
      // Plain text only
      lines.push(`Content-Type: text/plain; charset=utf-8`);
      lines.push(`Content-Transfer-Encoding: quoted-printable`);
      lines.push('');
      lines.push(mailOptions.text || '');
    }

    return lines.join('\r\n');
  }

  /**
   * Append sent email to Sent Items folder using IMAP APPEND
   */
  private async appendToSentFolder(mailOptions: any, messageId: string): Promise<void> {
    // Find the Sent Items folder
    const sentData = this.buildRFC822Message(mailOptions, messageId);
    const sentFolder = 'Sent Items';

    try {
      // Append message to Sent Items
      await this.client.append(sentFolder, sentData, ['\Seen'], new Date());
      this.logger.log(`Successfully appended message to ${sentFolder}`);
    } catch (error) {
      this.logger.error(`Error appending to ${sentFolder}: ${error.message}`);
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

  /**
   * Move message to another folder using IMAP MOVE
   */
  async moveMessage(
    messageId: string,
    targetFolder: string,
  ): Promise<{ success: boolean }> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    try {
      // Decode message ID to get source folder and UID
      const { folder: sourceFolder, uid } = this.decodeId(messageId);

      this.logger.log(
        `Moving message UID ${uid} from ${sourceFolder} to ${targetFolder}`,
      );

      // Get lock on source folder
      const lock = await this.client.getMailboxLock(sourceFolder);

      try {
        // Use native IMAP MOVE command
        const result = await this.client.messageMove(
          uid,
          targetFolder,
          { uid: true },
        );

        this.logger.log(
          `Successfully moved message to ${targetFolder}. Result: ${safeStringify(result)}`,
        );

        return { success: true };
      } finally {
        lock.release();
      }
    } catch (error) {
      this.logger.error(`Error moving message: ${error.message}`);
      throw error;
    }
  }

  async markMessages(ids: string[], isRead: boolean): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    // Group by folder
    const groups: Record<string, string[]> = {};
    for (const id of ids) {
      const { folder, uid } = this.decodeId(id);
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(uid);
    }

    // Process each folder
    for (const [folder, uids] of Object.entries(groups)) {
      const lock = await this.client.getMailboxLock(folder);
      try {
        const uidSet = uids.join(',');
        if (isRead) {
          await this.client.messageFlagsAdd(uidSet, ['\\Seen'], { uid: true });
        } else {
          await this.client.messageFlagsRemove(uidSet, ['\\Seen'], {
            uid: true,
          });
        }
      } catch (error) {
        this.logger.error(
          `Error marking messages in ${folder}: ${error.message}`,
        );
      } finally {
        lock.release();
      }
    }
  }

  async markAllMessages(folder: string, isRead: boolean): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const lock = await this.client.getMailboxLock(folder);
    try {
      if (isRead) {
        await this.client.messageFlagsAdd('1:*', ['\\Seen']);
      } else {
        await this.client.messageFlagsRemove('1:*', ['\\Seen']);
      }
    } catch (error) {
      this.logger.error(
        `Error marking all messages in ${folder}: ${error.message}`,
      );
      throw error;
    } finally {
      lock.release();
    }
  }
}
