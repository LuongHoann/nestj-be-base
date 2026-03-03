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
import * as mailparser from 'mailparser';
import {
  IMailProvider,
  MailFolder,
  MailMessage,
  SendMailOptions,
  SaveDraftOptions,
} from '../interfaces/mail-provider.interface';
import {
  getFolderAliases,
  MAIL_FOLDERS,
  resolveFolderId,
} from '../constants/mail-folders.constant';
import { ExchangeAuthService } from './exchange-auth.service';
import { SmtpSenderService } from './smtp-sender.service';
import { safeStringify } from '../utils/json.helper';

@Injectable({ scope: Scope.REQUEST })
export class ImapMailProvider implements IMailProvider {
  private readonly logger = new Logger(ImapMailProvider.name);
  private client: ImapFlow;
  private credentials: { email: string; password: string };
  private sessionToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: ExchangeAuthService,
    private readonly smtpSenderService: SmtpSenderService,
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

  async connect(): Promise<void> {
    // Get session token from cookie
    this.sessionToken = this.request.cookies?.['exchange_session'];

    if (!this.sessionToken) {
      throw new UnauthorizedException(
        'No session token provided. Please login first.',
      );
    }

    // Get credentials from session
    const creds = await this.authService.getCredentials(this.sessionToken);

    if (!creds) {
      throw new UnauthorizedException(
        'Session expired or invalid. Please login again.',
      );
    }

    this.credentials = creds;

    // IMAP
    this.client = new ImapFlow(this.getImapConfig() as any);
    await this.client.connect();
    this.logger.log(`IMAP connected for ${this.credentials.email}`);
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

  private normalizeFolderName(folder: string): string {
    return folder.trim().toLowerCase();
  }

  private getSpecialUseHints(folder: string): string[] {
    const canonicalFolder = resolveFolderId(folder, folder);

    switch (canonicalFolder) {
      case 'INBOX':
        return ['\\Inbox'];
      case 'Sent Items':
        return ['\\Sent'];
      case 'Drafts':
        return ['\\Drafts'];
      case 'Spam':
        return ['\\Junk'];
      case 'Trash':
        return ['\\Trash'];
      default:
        return [];
    }
  }

  private async getMailboxPathMap(): Promise<Map<string, string>> {
    const list = await this.client.list();
    const mailboxMap = new Map<string, string>();
    for (const mailbox of list) {
      mailboxMap.set(this.normalizeFolderName(mailbox.path), mailbox.path);
    }
    return mailboxMap;
  }

  private async resolveMailboxPath(folder: string): Promise<string | null> {
    const mailboxList = await this.client.list();
    const mailboxMap = new Map<string, string>();
    for (const mailbox of mailboxList) {
      mailboxMap.set(this.normalizeFolderName(mailbox.path), mailbox.path);
    }

    return this.resolveMailboxPathFromMap(folder, mailboxMap, mailboxList);
  }

  private resolveMailboxPathFromMap(
    folder: string,
    mailboxMap: Map<string, string>,
    mailboxList?: any[],
  ): string | null {
    const specialUseHints = this.getSpecialUseHints(folder);
    if (mailboxList?.length && specialUseHints.length) {
      for (const mailbox of mailboxList) {
        const specialUse = mailbox?.specialUse;
        const flags = mailbox?.flags;
        const hasSpecialUse =
          (typeof specialUse === 'string' &&
            specialUseHints.includes(specialUse)) ||
          (flags &&
            typeof flags.has === 'function' &&
            specialUseHints.some((hint) => flags.has(hint)));

        if (hasSpecialUse) {
          return mailbox.path;
        }
      }
    }

    const aliases = getFolderAliases(folder);

    for (const alias of aliases) {
      const found = mailboxMap.get(this.normalizeFolderName(alias));
      if (found) {
        return found;
      }
    }

    return null;
  }

  private async getStarredCounts(): Promise<{ total: number; unread: number }> {
    const mailboxList = await this.client.list();
    const mailboxMap = new Map<string, string>();
    for (const mailbox of mailboxList) {
      mailboxMap.set(this.normalizeFolderName(mailbox.path), mailbox.path);
    }

    const inboxPath = this.resolveMailboxPathFromMap(
      'INBOX',
      mailboxMap,
      mailboxList,
    );
    if (!inboxPath) {
      return { total: 0, unread: 0 };
    }

    const lock = await this.client.getMailboxLock(inboxPath);
    try {
      const searchResult = await this.client.search(
        { flagged: true },
        { uid: true },
      );
      const flaggedUids = Array.isArray(searchResult) ? searchResult : [];
      if (!flaggedUids.length) {
        return { total: 0, unread: 0 };
      }

      let unread = 0;
      const uidSet = flaggedUids.join(',');
      for await (const msg of this.client.fetch(
        uidSet,
        { flags: true, uid: true },
        { uid: true },
      )) {
        if (!msg.flags?.has('\\Seen')) unread++;
      }

      return { total: flaggedUids.length, unread };
    } catch (error) {
      this.logger.warn(`Failed to count Starred messages: ${error.message}`);
      return { total: 0, unread: 0 };
    } finally {
      lock.release();
    }
  }

  async getFolders(): Promise<MailFolder[]> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const mailboxList = await this.client.list();
    const mailboxMap = new Map<string, string>();
    for (const mailbox of mailboxList) {
      mailboxMap.set(this.normalizeFolderName(mailbox.path), mailbox.path);
    }

    const folders: MailFolder[] = [];

    for (const folder of MAIL_FOLDERS) {
      // Starred is virtual (Flagged in INBOX), show only when INBOX exists.
      if (folder.id === 'Starred') {
        if (mailboxMap.has('inbox')) {
          folders.push({ id: folder.id, name: folder.name });
        }
        continue;
      }

      const exists = !!this.resolveMailboxPathFromMap(
        folder.id,
        mailboxMap,
        mailboxList,
      );

      if (exists) {
        folders.push({ id: folder.id, name: folder.name });
      }
    }

    return folders;
  }

  async getFolderCounts(): Promise<
    Record<string, { total: number; unread: number }>
  > {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const counts: Record<string, { total: number; unread: number }> = {};
    const mailboxList = await this.client.list();
    const mailboxMap = new Map<string, string>();
    for (const mailbox of mailboxList) {
      mailboxMap.set(this.normalizeFolderName(mailbox.path), mailbox.path);
    }

    for (const folder of MAIL_FOLDERS) {
      try {
        if (folder.id === 'Starred') {
          counts[folder.id] = await this.getStarredCounts();
          continue;
        }

        const mailboxPath = this.resolveMailboxPathFromMap(
          folder.id,
          mailboxMap,
          mailboxList,
        );
        if (!mailboxPath) {
          counts[folder.id] = { total: 0, unread: 0 };
          continue;
        }

        const lock = await this.client.getMailboxLock(mailboxPath);
        try {
          const status = await this.client.status(mailboxPath, {
            messages: true,
            unseen: true,
          });
          counts[folder.id] = {
            total: status.messages || 0,
            unread: status.unseen || 0,
          };
        } finally {
          lock.release();
        }
      } catch (error) {
        this.logger.warn(
          `Failed to get count for folder ${folder.id}: ${error.message}`,
        );
        counts[folder.id] = { total: 0, unread: 0 };
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

    const canonicalFolderId = resolveFolderId(folderId, folderId);
    const isSentFolder = canonicalFolderId === 'Sent Items';
    if (canonicalFolderId === 'Starred') {
      return this.getStarredMessages(page, limit);
    }

    const mailboxPath = await this.resolveMailboxPath(canonicalFolderId);
    if (!mailboxPath) {
      return { items: [], total: 0 };
    }

    const lock = await this.client.getMailboxLock(mailboxPath);
    try {
      const status = await this.client.status(mailboxPath, { messages: true });
      const total = status.messages || 0;

      if (total === 0) {
        return { items: [], total: 0 };
      }

      // TÃ­nh toÃ¡n range cho pagination (newest first)
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
      // Reverse to show newest first
      messages.reverse();

      console.log('messages==', messages);

      const items = await Promise.all(
        messages.map(async (msg) => {
          let preview = '';
          let parsed: any = null;
          if (msg.source) {
            try {
              parsed = await mailparser.simpleParser(msg.source);
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

          const from = this.resolveFrom(msg, parsed, {
            fallbackEmail: this.credentials?.email,
            preferFallbackWhenX500: isSentFolder,
          });

          return {
            id: this.encodeId(mailboxPath, msg.uid.toString()),
            subject: msg.envelope.subject || '(No Subject)',
            from,
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

  private async getStarredMessages(
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
    const inboxPath = await this.resolveMailboxPath('INBOX');
    if (!inboxPath) {
      return { items: [], total: 0 };
    }

    const lock = await this.client.getMailboxLock(inboxPath);
    try {
      const flaggedUids: number[] = [];
      for await (const msg of this.client.fetch('1:*', {
        uid: true,
        flags: true,
      })) {
        if (msg.flags?.has('\\Flagged')) {
          flaggedUids.push(msg.uid);
        }
      }

      if (flaggedUids.length === 0) {
        return { items: [], total: 0 };
      }

      flaggedUids.sort((a, b) => b - a);
      const total = flaggedUids.length;
      const slicedUids = flaggedUids.slice((page - 1) * limit, page * limit);

      if (slicedUids.length === 0) {
        return { items: [], total };
      }

      const uidSet = slicedUids.join(',');
      const messages: any[] = [];

      for await (const msg of this.client.fetch(
        uidSet,
        {
          envelope: true,
          internalDate: true,
          bodyStructure: true,
          flags: true,
          uid: true,
          source: { maxLength: 1024 },
        },
        { uid: true },
      )) {
        messages.push(msg);
      }

      const items = await Promise.all(
        messages.map(async (msg) => {
          let preview = '';
          let parsed: any = null;
          if (msg.source) {
            try {
              parsed = await mailparser.simpleParser(msg.source);
              if (parsed.text) {
                preview = parsed.text;
              } else if (parsed.html) {
                preview = parsed.html.replace(/<[^>]*>?/gm, ' ');
              }

              if (preview) {
                preview = preview.replace(/\s+/g, ' ').trim().substring(0, 200);
              }
            } catch (error) {
              // Ignore parsing errors in list preview
            }
          }

          const from = this.resolveFrom(msg, parsed);

          return {
            id: this.encodeId(inboxPath, msg.uid.toString()),
            subject: msg.envelope.subject || '(No Subject)',
            from,
            receivedAt: msg.internalDate,
            isRead: msg.flags.has('\\Seen'),
            hasAttachments: this.checkAttachments(msg.bodyStructure),
            preview,
          };
        }),
      );

      return { items, total };
    } finally {
      lock.release();
    }
  }

  private mapAddress(addr: any): { name: string; email: string } {
    const address =
      addr.address ||
      (addr.mailbox && addr.host ? `${addr.mailbox}@${addr.host}` : '');

    const email =
      address && address.includes('@') && !address.startsWith('/')
        ? address
        : '';

    return {
      name: addr.name || '',
      email,
    };
  }

  private extractEmailFromHeader(value: unknown): string {
    if (typeof value !== 'string') return '';
    const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0] : '';
  }

  private formatAddressHeader(value: unknown): string {
    if (Array.isArray(value)) {
      return value.map((v) => this.formatAddressHeader(v)).join(', ');
    }

    if (typeof value !== 'string') return '';

    if (value.includes('<') && value.includes('>')) {
      return value;
    }

    const email = this.extractEmailFromHeader(value);
    if (!email) return value;

    const name = value.replace(email, '').replace(/[<>"]/g, '').trim();

    return name ? `"${name}" <${email}>` : `<${email}>`;
  }

  private resolveFrom(
    msg: any,
    parsed?: any,
    options?: { fallbackEmail?: string; preferFallbackWhenX500?: boolean },
  ): { name: string; email: string } {
    console.log('msg==', msg);
    console.log('parsed==', parsed);
    const fallbackEmail = options?.fallbackEmail || '';
    const preferFallback = !!options?.preferFallbackWhenX500;
    const parsedFrom = parsed?.from?.value?.[0];
    const parsedName = parsedFrom?.name || '';
    const parsedEmail = parsedFrom?.address || '';

    if (
      parsedEmail &&
      parsedEmail.includes('@') &&
      !parsedEmail.startsWith('/')
    ) {
      return { name: parsedName, email: parsedEmail };
    }
    if (preferFallback && parsedEmail.startsWith('/') && fallbackEmail) {
      return { name: parsedName, email: fallbackEmail };
    }

    const headerSender = this.extractEmailFromHeader(
      parsed?.headers?.get?.('sender'),
    );
    if (headerSender) {
      return { name: parsedName, email: headerSender };
    }

    const headerFrom = this.extractEmailFromHeader(
      parsed?.headers?.get?.('from'),
    );
    if (headerFrom) {
      return { name: parsedName, email: headerFrom };
    }

    if (msg?.envelope?.from?.[0]) {
      const mapped = this.mapAddress(msg.envelope.from[0]);
      if (!mapped.email && preferFallback && fallbackEmail) {
        return { name: mapped.name || parsedName, email: fallbackEmail };
      }
      return {
        name: mapped.name || parsedName,
        email: mapped.email,
      };
    }

    if (preferFallback && fallbackEmail) {
      return { name: parsedName, email: fallbackEmail };
    }

    return { name: parsedName, email: '' };
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

      const canonicalFolderId = resolveFolderId(folder, folder);
      const from = this.resolveFrom(msg, parsed, {
        fallbackEmail: this.credentials?.email,
        preferFallbackWhenX500: canonicalFolderId === 'Sent Items',
      });

      return {
        id: id,
        subject: parsed.subject || '(No Subject)',
        from,
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

      // Send email via shared SMTP pool (singleton service)
      const info = await this.smtpSenderService.sendMail(
        this.credentials,
        mailOptions,
      );

      this.logger.log(`Email sent successfully. MessageId: ${info.messageId}`);

      // Append to Sent Items while IMAP connection is still alive
      if (info.messageId) {
        try {
          await this.appendToSentFolder(mailOptions, info.messageId);
          this.logger.log(`Email appended to Sent Items folder`);
        } catch (err) {
          this.logger.warn(
            `Failed to append email to Sent Items: ${err.message}`,
          );
        }
      } else {
        this.logger.warn(
          'Skip appending to Sent Items because messageId is missing',
        );
      }

      return {
        success: !!info.messageId,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`);
      throw error;
    }
  }

  async saveDraft(
    options: SaveDraftOptions,
  ): Promise<{ success: boolean; messageId?: string }> {
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
        to: options.to ?? [],
        cc: options.cc ?? [],
        bcc: options.bcc ?? [],
        replyTo: options.replyTo ?? [],
        subject: options.subject ?? '',
        text: options.text,
        html: options.html,
        attachments,
      };

      const draftsFolder =
        (await this.resolveMailboxPath('Drafts')) ?? 'Drafts';
      const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@drafts>`;
      const draftData = this.buildRFC822Message(mailOptions, messageId);

      const appendRes = await this.client.append(
        draftsFolder,
        draftData,
        ['\\Seen', '\\Draft'],
        new Date(),
      );
      let resId: string | undefined;

      if (appendRes && appendRes.uid) {
        resId = this.encodeId(draftsFolder, appendRes.uid.toString());
      }

      return { success: true, messageId: resId };
    } catch (error) {
      this.logger.error(`Error saving draft via IMAP: ${error.message}`);
      throw error;
    }
  }

  private buildRFC822Message(mailOptions: any, messageId: string): string {
    const lines: string[] = [];

    // Headers
    lines.push(`Message-ID: ${messageId}`);
    lines.push(`Date: ${new Date().toUTCString()}`);
    const fromHeader = this.formatAddressHeader(mailOptions.from);
    lines.push(`From: ${fromHeader}`);
    const senderEmail = this.extractEmailFromHeader(fromHeader);
    if (senderEmail) {
      lines.push(`Sender: <${senderEmail}>`);
    }

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
      const replyToHeader = this.formatAddressHeader(mailOptions.replyTo);
      lines.push(`Reply-To: ${replyToHeader}`);
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
        lines.push(
          `Content-Type: ${att.contentType || 'application/octet-stream'}`,
        );
        lines.push(`Content-Transfer-Encoding: base64`);
        lines.push(
          `Content-Disposition: attachment; filename="${att.filename}"`,
        );
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
  private async appendToSentFolder(
    mailOptions: any,
    messageId: string,
  ): Promise<void> {
    // Find the Sent Items folder
    const sentData = this.buildRFC822Message(mailOptions, messageId);
    const sentFolder =
      (await this.resolveMailboxPath('Sent Items')) ?? 'Sent Items';

    try {
      // Append message to Sent Items
      await this.client.append(sentFolder, sentData, ['\\Seen'], new Date());
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

    const folderId = (await this.resolveMailboxPath('INBOX')) ?? 'INBOX';
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
        {
          envelope: true,
          internalDate: true,
          uid: true,
          flags: true,
          source: { maxLength: 1024 },
        },
        { uid: true },
      )) {
        messages.push(msg);
      }

      const items = await Promise.all(
        messages.map(async (msg) => {
          let parsed: any = null;
          if (msg.source) {
            try {
              parsed = await mailparser.simpleParser(msg.source);
            } catch (error) {
              // Ignore parsing errors in search result
            }
          }

          return {
            id: this.encodeId(folderId, msg.uid.toString()),
            subject: msg.envelope.subject || '(No Subject)',
            from: this.resolveFrom(msg, parsed),
            receivedAt: msg.internalDate,
            isRead: msg.flags.has('\\Seen'),
            hasAttachments: false, // Skip for search results performance
          };
        }),
      );

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

      const resolvedTargetFolder =
        (await this.resolveMailboxPath(targetFolder)) ?? targetFolder;

      this.logger.log(
        `Moving message UID ${uid} from ${sourceFolder} to ${resolvedTargetFolder}`,
      );

      // Get lock on source folder
      const lock = await this.client.getMailboxLock(sourceFolder);

      try {
        // Use native IMAP MOVE command
        const result = await this.client.messageMove(
          uid,
          resolvedTargetFolder,
          { uid: true },
        );

        this.logger.log(
          `Successfully moved message to ${resolvedTargetFolder}. Result: ${safeStringify(result)}`,
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

    const resolvedFolder = (await this.resolveMailboxPath(folder)) ?? folder;
    const lock = await this.client.getMailboxLock(resolvedFolder);
    try {
      if (isRead) {
        await this.client.messageFlagsAdd('1:*', ['\\Seen']);
      } else {
        await this.client.messageFlagsRemove('1:*', ['\\Seen']);
      }
    } catch (error) {
      this.logger.error(
        `Error marking all messages in ${resolvedFolder}: ${error.message}`,
      );
      throw error;
    } finally {
      lock.release();
    }
  }

  async moveMessagesBatch(ids: string[], targetFolder: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const resolvedTargetFolder =
      (await this.resolveMailboxPath(targetFolder)) ?? targetFolder;

    // Group by source folder
    const groups: Record<string, string[]> = {};
    for (const id of ids) {
      const { folder, uid } = this.decodeId(id);
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(uid);
    }

    // Process each source folder
    for (const [sourceFolder, uids] of Object.entries(groups)) {
      if (sourceFolder === resolvedTargetFolder) continue; // Skip if same folder

      const lock = await this.client.getMailboxLock(sourceFolder);
      try {
        const uidSet = uids.join(',');
        await this.client.messageMove(uidSet, resolvedTargetFolder, {
          uid: true,
        });
        this.logger.log(
          `Moved ${uids.length} messages from ${sourceFolder} to ${resolvedTargetFolder}`,
        );
      } catch (error) {
        this.logger.error(
          `Error moving messages from ${sourceFolder}: ${error.message}`,
        );
      } finally {
        lock.release();
      }
    }
  }

  async moveAllMessages(
    sourceFolder: string,
    targetFolder: string,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const resolvedSourceFolder =
      (await this.resolveMailboxPath(sourceFolder)) ?? sourceFolder;
    const resolvedTargetFolder =
      (await this.resolveMailboxPath(targetFolder)) ?? targetFolder;

    if (resolvedSourceFolder === resolvedTargetFolder) return;

    const lock = await this.client.getMailboxLock(resolvedSourceFolder);
    try {
      await this.client.messageMove('1:*', resolvedTargetFolder);
      this.logger.log(
        `Moved all messages from ${resolvedSourceFolder} to ${resolvedTargetFolder}`,
      );
    } catch (error) {
      this.logger.error(
        `Error moving all messages from ${resolvedSourceFolder}: ${error.message}`,
      );
      throw error;
    } finally {
      lock.release();
    }
  }

  async permanentlyDeleteMessages(ids: string[]): Promise<number> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const groups: Record<string, string[]> = {};
    for (const id of ids) {
      const { folder, uid } = this.decodeId(id);
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(uid);
    }

    let deletedCount = 0;

    for (const [folder, uids] of Object.entries(groups)) {
      const lock = await this.client.getMailboxLock(folder);
      try {
        const uidSet = uids.join(',');
        await this.client.messageDelete(uidSet, { uid: true });
        deletedCount += uids.length;
      } catch (error) {
        this.logger.error(
          `Error permanently deleting messages in ${folder}: ${error.message}`,
        );
        throw error;
      } finally {
        lock.release();
      }
    }

    return deletedCount;
  }

  async permanentlyDeleteAllMessages(folder: string): Promise<number> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const canonicalFolderId = resolveFolderId(folder, folder);

    if (canonicalFolderId === 'Starred') {
      const inboxPath = await this.resolveMailboxPath('INBOX');
      if (!inboxPath) {
        return 0;
      }

      const lock = await this.client.getMailboxLock(inboxPath);
      try {
        const flaggedUids: number[] = [];
        for await (const msg of this.client.fetch('1:*', {
          uid: true,
          flags: true,
        })) {
          if (msg.flags?.has('\\Flagged')) {
            flaggedUids.push(msg.uid);
          }
        }

        if (!flaggedUids.length) {
          return 0;
        }

        await this.client.messageDelete(flaggedUids.join(','), { uid: true });
        return flaggedUids.length;
      } finally {
        lock.release();
      }
    }

    const resolvedFolder =
      (await this.resolveMailboxPath(canonicalFolderId)) ?? canonicalFolderId;
    const lock = await this.client.getMailboxLock(resolvedFolder);

    try {
      const status = await this.client.status(resolvedFolder, {
        messages: true,
      });
      const total = status.messages || 0;
      if (!total) {
        return 0;
      }

      await this.client.messageDelete('1:*');
      return total;
    } catch (error) {
      this.logger.error(
        `Error permanently deleting all messages in ${resolvedFolder}: ${error.message}`,
      );
      throw error;
    } finally {
      lock.release();
    }
  }
}
