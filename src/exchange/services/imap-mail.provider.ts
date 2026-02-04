import { Injectable, Scope, Inject, Logger, UnauthorizedException } from '@nestjs/common';
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
import { RequestContext } from '../../common/context/request.context';

@Injectable({ scope: Scope.REQUEST })
export class ImapMailProvider implements IMailProvider {
  private readonly logger = new Logger(ImapMailProvider.name);
  private client: ImapFlow;
  private transporter: nodemailer.Transporter;
  private credentials: { user: string; pass: string };

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: ExchangeAuthService,
    private readonly context: RequestContext,
  ) {}

  private getImapConfig() {
    // Production constraint: Use env vars, ensure TLS 1.2+
    const host = this.configService.get<string>('IMAP_HOST', 'outlook.office365.com');
    const port = this.configService.get<number>('IMAP_PORT', 993);
    const secure = this.configService.get<boolean>('IMAP_SECURE', true);

    return {
      host,
      port,
      secure,
      auth: this.credentials,
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true, // Strict validation for production
      },
      logger: false, // Too verbose for production
    };
  }

  private getSmtpConfig() {
    const host = this.configService.get<string>('SMTP_HOST', 'smtp.office365.com');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const isSecure = port === 465; 

    return {
      host,
      port,
      secure: isSecure,
      auth: this.credentials,
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      },
    };
  }

  async connect(): Promise<void> {
    const user = this.context.user;
    if (!user || !user.id) {
        throw new UnauthorizedException('User context required for Mail access');
    }

    const creds = await this.authService.getStoredCredentials(String(user.id));
    if (!creds) {
        throw new UnauthorizedException('Mail session expired. Please login again.');
    }
    this.credentials = creds;

    this.client = new ImapFlow(this.getImapConfig() as any);
    await this.client.connect();

    this.transporter = nodemailer.createTransport(this.getSmtpConfig() as any);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.logout();
    }
    // Nodemailer transporter doesn't need explicit disconnect usually, 
    // but if pooled, we might close it. Basic transporter is stateless-ish.
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
    if (!this.client) throw new Error('Client not connected');
    
    // Static mapping or fetch from server. Fetching is better to check existence.
    const list = await this.client.list();
    const folderMap = {
      INBOX: 'Inbox',
      'Sent Items': 'Sent',
      'Drafts': 'Drafts',
      'Deleted Items': 'Trash',
      'Junk Email': 'Junk'
    };

    // Simplify for MVP: standard folders
    // We try to find standard folders in the list
    const folders: MailFolder[] = [];
    
    // Helper to find folder by name case-insensitive or by usage
    // For MVP, return hardcoded list that maps to what we expect on server
    // But ideally we verify availability.
    
    return [
      { id: 'INBOX', name: 'Hộp thư đến' },
      { id: 'Sent Items', name: 'Đã gửi' },
      { id: 'Drafts', name: 'Thư nháp' },
      { id: 'Deleted Items', name: 'Thùng rác' },
    ];
  }

  async getMessages(
    folderId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
    if (!this.client) throw new Error('Client not connected');

    const lock = await this.client.getMailboxLock(folderId);
    try {
      const status = await this.client.status(folderId, { messages: true });
      const total = status.messages || 0;
      
      if (total === 0) {
        return { items: [], total: 0 };
      }

      // IMAP uses 1-based indexing.
      // Sort is complex in IMAP without widely supported extensions (SORT).
      // Basic fetch returns old to new by sequence number.
      // We want new to old.
      // Easiest way in plain IMAP: range from total down to ...
      
      // Page 1 (limit 20): total .. total - 19
      // Page 2: total - 20 .. total - 39
      
      const to = Math.max(1, total - (page - 1) * limit);
      const from = Math.max(1, to - limit + 1);
      
      // In ImapFlow, fetch can take a sequence range
      // Range "10:20" included.
      
      // If page is out of bounds
      if (to < 1) {
          return { items: [], total };
      }

      const seqRange = `${from}:${to}`; 
      
      // Fetch headers + envelope
      // Fetching messages in descending order via sequence numbers is implicit if we process result correctly?
      // Actually fetch returns async iterator.
      
      const messages: any[] = [];
      for await (const msg of this.client.fetch(seqRange, { envelope: true, internalDate: true, bodyStructure: true, flags: true })) {
        messages.push(msg);
      }

      // Default fetch order usually ascending sequence. Reverse for UI (newest first).
      messages.reverse();

      const items = messages.map((msg) => ({
        id: this.encodeId(folderId, msg.uid.toString()),
        subject: msg.envelope.subject,
        from: msg.envelope.from ? this.mapAddress(msg.envelope.from[0]) : { name: '', email: '' },
        receivedAt: msg.internalDate,
        isRead: msg.flags.has('\\Seen'),
        hasAttachments: this.checkAttachments(msg.bodyStructure),
        preview: 'Loading...', // Fetching preview (snippet) requires BODY.PEEK and parsing, heavy for list. Skip for MVP/Perf.
      }));

      return { items, total };
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
      // Heuristic: multipart mixed or having parts with disposition attachment
      // Deep check omitted for brevity, checking if multipart/mixed or related often helps
      // ImapFlow provides simple structure
      return struct.childNodes && struct.childNodes.some((node: any) => 
          node.disposition === 'attachment' || (node.parameters && node.parameters.name)
      );
  }

  async getMessage(id: string): Promise<MailMessage> {
    if (!this.client) throw new Error('Client not connected');

    const { folder, uid } = this.decodeId(id);
    const lock = await this.client.getMailboxLock(folder);
    try {
      // Use fetchOne with uid
      const msg = await this.client.fetchOne(uid, { source: true, flags: true, uid: true }, { uid: true });
      if (!msg) throw new Error('Message not found');

      // Mark as read
      if (msg.flags && !msg.flags.has('\\Seen')) {
         await this.client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      }

      if (!msg.source) throw new Error('Message source not found');

      // Parse source
      const parsed: any = await mailparser.simpleParser(msg.source);

      return {
        id: id,
        subject: parsed.subject,
        from: parsed.from?.value?.[0] ? { name: parsed.from.value[0].name, email: parsed.from.value[0].address } : { name: '', email: '' },
        to: Array.isArray(parsed.to) ? parsed.to.map((t: any) => ({ name: t.name, email: t.address })) : (parsed.to && parsed.to.value ? parsed.to.value.map((t: any) => ({ name: t.name, email: t.address })) : []),
        cc: Array.isArray(parsed.cc) ? parsed.cc.map((t: any) => ({ name: t.name, email: t.address })) : (parsed.cc && parsed.cc.value ? parsed.cc.value.map((t: any) => ({ name: t.name, email: t.address })) : []),
        receivedAt: parsed.date,
        body: (parsed.html as string) || (parsed.textAsHtml as string) || (parsed.text as string),
        isHtml: !!parsed.html,
        hasAttachments: parsed.attachments && parsed.attachments.length > 0,
        isRead: true, 
        preview: parsed.text ? parsed.text.substring(0, 100) : '',
      };
    } finally {
      lock.release();
    }
  }

  async sendMessage(options: SendMailOptions): Promise<{ success: boolean; messageId?: string }> {
     if (!this.transporter) throw new Error('Transporter not ready');

     const info = await this.transporter.sendMail({
         from: this.credentials.user,
         to: options.to,
         cc: options.cc,
         subject: options.subject,
         html: options.body, // Assume HTML body
     });
     
     return { success: !!info.messageId, messageId: info.messageId };
  }

  async search(
    query: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
     if (!this.client) throw new Error('Client not connected');
     
     // Default search in INBOX
     const folderId = 'INBOX';
     
     const lock = await this.client.getMailboxLock(folderId);
     try {
         // IMAP SEARCH
         // Simple search: OR SUBJECT query FROM query
         const searchCriteria = {
             or: [
                 { header: { key: 'subject', value: query } },
                 { header: { key: 'from', value: query } }
             ]
         };
         
         const uids = await this.client.search(searchCriteria, { uid: true });
         if (uids === false) {
             return { items: [], total: 0 };
         }
         
         const total = uids.length;
         
         if (total === 0) return { items: [], total: 0 };
         
         // Pagination on UIDs (descending)
         uids.reverse();
         const slicedUids = uids.slice((page - 1) * limit, page * limit);
         
         if (slicedUids.length === 0) return { items: [], total };

         // Fetch details for these UIDs
         const messages: any[] = [];
         
         // Fetch individually or range if extensive support (ImapFlow fetch supports array of UIDs?)
         const uidSet = slicedUids.join(',');
         
         for await (const msg of this.client.fetch(uidSet, { envelope: true, internalDate: true, uid: true }, { uid: true })) {
            messages.push(msg);
         }
         
         // Map to items
         const items = messages.map((msg) => ({
            id: this.encodeId(folderId, msg.uid.toString()),
            subject: msg.envelope.subject,
            from: msg.envelope.from ? this.mapAddress(msg.envelope.from[0]) : { name: '', email: '' },
            receivedAt: msg.internalDate,
            isRead: false, // Flags required
         }));
         
         // Ensure order matches search result order? map/filter might reshuffle if async
         // Sort simply by date desc
         items.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

         return { items, total };
     } finally {
         lock.release();
     }
  }
}
