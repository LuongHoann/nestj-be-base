import {
  Injectable,
  Scope,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  ExchangeService,
  ExchangeVersion,
  WebCredentials,
  Uri,
  WellKnownFolderName,
  Folder,
  FolderId,
  ItemView,
  SearchFilter,
  LogicalOperator,
  SortDirection,
  PropertySet,
  BasePropertySet,
  EmailMessage,
  EmailAddress,
  MessageBody,
  BodyType,
  FolderSchema,
  EmailMessageSchema,
  ItemSchema,
  ItemId,
  DeleteMode,
  SendCancellationsMode,
  AffectedTaskOccurrence,
  ConflictResolutionMode,
  ServiceResponseCollection,
  ServiceError,
  ExtendedPropertyDefinition,
  MapiPropertyType,
} from 'ews-javascript-api';
import { XhrApi } from '@ewsjs/xhr';
import { DragonflyService } from '../../common/cache/dragonfly.service';
import { ExchangeAuthService } from './exchange-auth.service';
import { SmtpSenderService } from './smtp-sender.service';
import {
  MAIL_FOLDERS,
  resolveFolderId,
} from '../constants/mail-folders.constant';
import {
  IMailProvider,
  MailFolder,
  MailMessage,
  SendMailOptions,
} from '../interfaces/mail-provider.interface';

(ExchangeService as any).XHRApi = new XhrApi();

// ─── MAPI Extended Properties cho Flag/Star ───────────────────────────────────
// Đây là cách chuẩn và đáng tin nhất với Exchange 2019 on-premises.
// EmailMessageSchema.Flag thường không đồng bộ đúng qua EWS.

/** PR_FLAG_STATUS (0x1090) — 0=NoFlag, 1=Flagged(Starred), 2=Complete */
const PR_FLAG_STATUS = new ExtendedPropertyDefinition(0x1090, MapiPropertyType.Integer);
/** PR_TODO_TITLE (0x0E2B) — thường là "Follow up" khi flag */
const PR_TODO_TITLE  = new ExtendedPropertyDefinition(0x0E2B, MapiPropertyType.String);
/** PR_FOLLOWUP_ICON (0x1095) — màu flag, 6 = red (default Outlook star) */
const PR_FOLLOWUP_ICON = new ExtendedPropertyDefinition(0x1095, MapiPropertyType.Integer);
/** PR_SENDER_SMTP_ADDRESS (0x5D01) — SMTP thực của sender, không bị X500 */
const PR_SENDER_SMTP_ADDRESS = new ExtendedPropertyDefinition(0x5D01, MapiPropertyType.String);
/** PR_SENT_REPRESENTING_SMTP_ADDRESS (0x5D02) — SMTP của người được đại diện gửi */
const PR_SENT_REPRESENTING_SMTP_ADDRESS = new ExtendedPropertyDefinition(0x5D02, MapiPropertyType.String);

enum FlagStatus {
  NoFlag   = 0,
  Flagged  = 1,
  Complete = 2,
}

// ─── PropertySets tái sử dụng ─────────────────────────────────────────────────

/** Dùng cho list — không load body để tối ưu tốc độ */
const LIST_PROPS = new PropertySet(
  BasePropertySet.IdOnly,
  ItemSchema.Subject,
  ItemSchema.DateTimeReceived,
  EmailMessageSchema.From,
  EmailMessageSchema.IsRead,
  ItemSchema.HasAttachments,
  ItemSchema.Categories,
  PR_FLAG_STATUS,
  PR_SENDER_SMTP_ADDRESS,
  PR_SENT_REPRESENTING_SMTP_ADDRESS,
);

/** Dùng khi load chi tiết message */
const DETAIL_PROPS = new PropertySet(
  BasePropertySet.FirstClassProperties,
  ItemSchema.Categories,
  PR_FLAG_STATUS,
  PR_TODO_TITLE,
  PR_FOLLOWUP_ICON,
  PR_SENDER_SMTP_ADDRESS,
  PR_SENT_REPRESENTING_SMTP_ADDRESS,
);

/** Dùng khi chỉ cần set/unset flag */
const FLAG_ONLY_PROPS = new PropertySet(
  BasePropertySet.IdOnly,
  ItemSchema.Categories,
  PR_FLAG_STATUS,
  PR_TODO_TITLE,
  PR_FOLLOWUP_ICON,
);

@Injectable({ scope: Scope.REQUEST })
export class EwsMailProvider implements IMailProvider {
  private readonly logger = new Logger(EwsMailProvider.name);
  private service: ExchangeService | null = null;
  private email: string | null = null;
  private credentials: { email: string; password: string } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly cache: DragonflyService,
    private readonly authService: ExchangeAuthService,
    private readonly smtpSenderService: SmtpSenderService,
    @Inject(REQUEST) private readonly request: any,
  ) {}


  private parseEmailAddress(value: string): { name: string; email: string } {
    const trimmed = value?.trim?.() ?? '';
    if (!trimmed) return { name: '', email: '' };

    const angleMatch = trimmed.match(/^(.+?)<([^>]+)>$/);
    if (angleMatch) {
      return {
        name: angleMatch[1].replace(/\"/g, '').trim(),
        email: angleMatch[2].trim(),
      };
    }

    const emailMatch = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) {
      return { name: '', email: emailMatch[0] };
    }

    return { name: '', email: '' };
  }

  private toEmailAddress(value: string): EmailAddress | null {
    const { name, email } = this.parseEmailAddress(value);
    if (!email) return null;
    const addr = name ? new EmailAddress(name, email) : new EmailAddress(email);
    addr.RoutingType = 'SMTP';
    return addr;
  }

  // ─── Config ───────────────────────────────────────────────────────────────

  private get ewsConfig() {
    return {
      url:     this.configService.get<string>('EWS_URL') ?? '',
      version: this.configService.get<string>('EWS_VERSION') ?? 'Exchange2016',
      tlsRejectUnauthorized:
        this.configService.get<string>('EWS_TLS_REJECT_UNAUTHORIZED') !== 'false',
    };
  }

  // ─── Connect / Disconnect ─────────────────────────────────────────────────

  async connect(): Promise<void> {
    const sessionToken = this.request.cookies?.['exchange_session'];
    if (!sessionToken) throw new UnauthorizedException('No session token provided');

    const creds = await this.authService.getCredentials(sessionToken);
    if (!creds)  throw new UnauthorizedException('Session expired or invalid');
    if (!creds.password) throw new UnauthorizedException('Password not found in credentials');

    this.email = creds.email;
    this.credentials = { email: creds.email, password: creds.password };

    const cfg = this.ewsConfig;
    if (!cfg.url) throw new Error('EWS_URL is not configured');

    if (!cfg.tlsRejectUnauthorized) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    // Exchange 2019 on-premises tương thích với ExchangeVersion.Exchange2016
    const version =
      ExchangeVersion[cfg.version as keyof typeof ExchangeVersion] ??
      ExchangeVersion.Exchange2016;

    const service       = new ExchangeService(version);
    service.Url         = new Uri(cfg.url);
    service.Credentials = new WebCredentials(creds.email, creds.password);

    this.service = service;
  }

  async disconnect(): Promise<void> {
    this.service = null;
    this.credentials = null;
  }

  // ─── Folder helpers ───────────────────────────────────────────────────────

  private resolveFolderName(folderId: string): WellKnownFolderName {
    const resolved = resolveFolderId(folderId, folderId).toLowerCase();
    switch (resolved) {
      case 'inbox':
        return WellKnownFolderName.Inbox;
      case 'sent items':
      case 'sent':
        return WellKnownFolderName.SentItems;
      case 'drafts':
        return WellKnownFolderName.Drafts;
      case 'spam':
      case 'junkemail':
      case 'junk':
        return WellKnownFolderName.JunkEmail;
      case 'trash':
      case 'deleteditems':
      case 'deleted':
        return WellKnownFolderName.DeletedItems;
      default:
        return WellKnownFolderName.Inbox;
    }
  }

  private toFolderId(folder: WellKnownFolderName): FolderId {
    return new FolderId(folder);
  }

  // ─── ID helpers ───────────────────────────────────────────────────────────

  private encodeId(folder: string, itemId: string): string {
    return Buffer.from(`${folder}:${itemId}`).toString('base64');
  }

  private decodeId(id: string): { folder: string; itemId: string } {
    const decoded    = Buffer.from(id, 'base64').toString('utf8');
    const colonIndex = decoded.indexOf(':');
    return {
      folder: decoded.slice(0, colonIndex),
      // Dùng indexOf tránh split sai nếu EWS UniqueId chứa ':'
      itemId: decoded.slice(colonIndex + 1),
    };
  }

  // ─── Type helpers ─────────────────────────────────────────────────────────

  private toJsDate(value: any): Date {
    if (!value)                               return new Date();
    if (value instanceof Date)                return value;
    if (typeof value.ToDate === 'function')   return value.ToDate();
    if (typeof value.ToISOString === 'function') return new Date(value.ToISOString());
    return new Date(value);
  }

  /**
   * Kiểm tra xem address có phải X500/X400 DN không.
   * Exchange on-premises lưu internal senders dưới dạng:
   *   /O=ORGNAME/OU=GROUP/CN=RECIPIENTS/CN=hash-USERNAME
   */
  private isX500Address(address: string): boolean {
    const upper = address.toUpperCase();
    return (
      upper.startsWith('/O=') ||
      upper.startsWith('/OU=') ||
      upper.startsWith('/CN=') ||
      upper.startsWith('C=') ||
      upper.startsWith('G=')
    );
  }

  /**
   * Lấy SMTP thực từ MAPI extended properties PR_SENDER_SMTP_ADDRESS (0x5D01)
   * hoặc PR_SENT_REPRESENTING_SMTP_ADDRESS (0x5D02).
   *
   * Đây là cách đáng tin nhất để lấy email thật với Sent Items,
   * vì EmailMessage.From.Address thường là X500 DN với Exchange on-premises.
   */
  private getSenderSmtpFromExtProps(item: any): string {
    const extProps: any[] = item?.ExtendedProperties?.items ?? item?.ExtendedProperties ?? [];
    for (const ep of extProps) {
      const tag = ep?.PropertyDefinition?.Tag ?? ep?.Tag;
      // 0x5D01 = PR_SENDER_SMTP_ADDRESS, 0x5D02 = PR_SENT_REPRESENTING_SMTP_ADDRESS
      if ((tag === 0x5D01 || tag === 0x5D02) && ep.Value) {
        return String(ep.Value);
      }
    }
    return '';
  }

  private getFrom(item: any): { name: string; email: string } {
    const raw = item?.From ?? item?.Sender;
    const name = raw?.Name ?? '';
    const rawAddress = raw?.Address ?? '';

    // DEBUG — xóa sau khi xác định đúng field
    this.logger.debug(`[getFrom] raw.Name=${name} raw.Address=${rawAddress}`);
    this.logger.debug(`[getFrom] ExtendedProperties=${JSON.stringify(
      item?.ExtendedProperties?.items ?? item?.ExtendedProperties ?? []
    )}`);
    this.logger.debug(`[getFrom] item keys=${Object.keys(item || {}).join(',')}`);

    // Nếu address là X500 DN → thử lấy SMTP thực từ MAPI extended properties
    if (!rawAddress || this.isX500Address(rawAddress)) {
      const smtpFromMapi = this.getSenderSmtpFromExtProps(item);
      this.logger.debug(`[getFrom] X500 detected, smtpFromMapi=${smtpFromMapi}`);
      // Fallback: nếu MAPI cũng không có, trả về X500 gốc để không mất data
      return { name, email: smtpFromMapi || rawAddress };
    }

    return { name, email: rawAddress };
  }

  private getRecipients(collection: any): { name: string; email: string }[] {
    const items: any[] = collection?.items ?? collection?.Items ?? [];
    return items.map((a: any) => {
      const addr = a.Address ?? '';
      return {
        name:  a.Name ?? '',
        // Recipients thường dùng SMTP, nhưng vẫn check X500 phòng trường hợp
        email: this.isX500Address(addr) ? '' : addr,
      };
    });
  }

  // ─── Starred helpers ──────────────────────────────────────────────────────

  /**
   * Đọc trạng thái starred từ MAPI PR_FLAG_STATUS.
   * Fallback sang EmailMessageSchema.Flag rồi Categories.
   *
   * Trên Exchange 2019 on-premises, PR_FLAG_STATUS là nguồn đáng tin nhất.
   * EmailMessageSchema.Flag đôi khi không serialize đúng qua ews-javascript-api.
   */
  private isItemStarred(item: any): boolean {
    try {
      // Ưu tiên: MAPI extended property PR_FLAG_STATUS
      const extProps: any[] =
        item.ExtendedProperties?.items ?? item.ExtendedProperties ?? [];

      for (const ep of extProps) {
        const tag = ep?.PropertyDefinition?.Tag ?? ep?.Tag;
        if (tag === 0x1090) {
          return Number(ep.Value) === FlagStatus.Flagged;
        }
      }

      // Fallback 1: EmailMessageSchema.Flag object
      const flagStatus = item.Flag?.FlagStatus ?? item.FlagStatus;
      if (flagStatus !== undefined && flagStatus !== null) {
        return Number(flagStatus) === FlagStatus.Flagged;
      }

      // Fallback 2: Categories chứa "Starred" (Outlook on mobile thường dùng cách này)
      const cats: any[] = item.Categories?.items ?? item.Categories ?? [];
      return cats.some((c) => String(c).toLowerCase() === 'starred');
    } catch {
      return false;
    }
  }

  /**
   * Set/unset flag trên message qua MAPI extended properties.
   * Đây là cách chuẩn cho Exchange 2019 on-premises — đồng bộ với Outlook client.
   */
  private async setFlag(message: EmailMessage, starred: boolean): Promise<void> {
    if (starred) {
      message.SetExtendedProperty(PR_FLAG_STATUS,   FlagStatus.Flagged);
      message.SetExtendedProperty(PR_TODO_TITLE,    'Follow up');
      message.SetExtendedProperty(PR_FOLLOWUP_ICON, 6); // Red flag (default Outlook star)
    } else {
      message.SetExtendedProperty(PR_FLAG_STATUS,   FlagStatus.NoFlag);
      message.SetExtendedProperty(PR_TODO_TITLE,    '');
      message.SetExtendedProperty(PR_FOLLOWUP_ICON, 0);
    }
    await message.Update(ConflictResolutionMode.AlwaysOverwrite);
  }

  // ─── Folders ──────────────────────────────────────────────────────────────

  async getFolders(): Promise<MailFolder[]> {
    if (!this.service) throw new Error('EWS service not connected');

    const folders: MailFolder[] = [];
    for (const folder of MAIL_FOLDERS) {
      if (folder.id === 'Starred') {
        folders.push({ id: folder.id, name: folder.name });
        continue;
      }
      try {
        await Folder.Bind(this.service, new FolderId(this.resolveFolderName(folder.id)));
        folders.push({ id: folder.id, name: folder.name });
      } catch (err) {
        this.logger.warn(`Cannot bind folder ${folder.id}: ${err.message}`);
      }
    }
    return folders;
  }

  async getFolderCounts(): Promise<Record<string, { total: number; unread: number }>> {
    if (!this.service) throw new Error('EWS service not connected');

    const counts: Record<string, { total: number; unread: number }> = {};
    const countProps = new PropertySet(
      BasePropertySet.IdOnly,
      FolderSchema.TotalCount,
      FolderSchema.UnreadCount,
    );

    for (const folder of MAIL_FOLDERS) {
      if (folder.id === 'Starred') {
        counts[folder.id] = await this.getStarredCounts();
        continue;
      }
      try {
        const bound = await Folder.Bind(
          this.service,
          new FolderId(this.resolveFolderName(folder.id)),
          countProps,
        );
        counts[folder.id] = {
          total:  bound.TotalCount  ?? 0,
          unread: bound.UnreadCount ?? 0,
        };
      } catch (err) {
        this.logger.warn(`getFolderCounts ${folder.id}: ${err.message}`);
        counts[folder.id] = { total: 0, unread: 0 };
      }
    }
    return counts;
  }

  private async getStarredCounts(): Promise<{ total: number; unread: number }> {
    if (!this.service) throw new Error('EWS service not connected');
    try {
      const countView     = new ItemView(1, 0);
      // Dùng MAPI filter để tìm đúng flagged items
      const starredFilter = new SearchFilter.IsEqualTo(PR_FLAG_STATUS, FlagStatus.Flagged);

      const totalResult = await this.service.FindItems(
        WellKnownFolderName.Inbox,
        starredFilter,
        countView,
      );

      if (!totalResult.TotalCount) return { total: 0, unread: 0 };

      const unreadResult = await this.service.FindItems(
        WellKnownFolderName.Inbox,
        new SearchFilter.SearchFilterCollection(LogicalOperator.And, [
          starredFilter,
          new SearchFilter.IsEqualTo(EmailMessageSchema.IsRead, false),
        ]),
        countView,
      );

      return {
        total:  totalResult.TotalCount  ?? 0,
        unread: unreadResult.TotalCount ?? 0,
      };
    } catch (err) {
      this.logger.warn(`getStarredCounts: ${err.message}`);
      return { total: 0, unread: 0 };
    }
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  async getMessages(
    folderId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
    if (!this.service) throw new Error('EWS service not connected');

    const resolvedId     = resolveFolderId(folderId, folderId);
    const resolvedFolder = this.resolveFolderName(folderId);
    const offset         = (page - 1) * limit;

    const view = new ItemView(limit, offset);
    view.OrderBy.Add(ItemSchema.DateTimeReceived, SortDirection.Descending);
    view.PropertySet = LIST_PROPS;

    let result: any;

    if (resolvedId === 'Starred') {
      try {
        const filter = new SearchFilter.IsEqualTo(PR_FLAG_STATUS, FlagStatus.Flagged);
        result = await this.service.FindItems(WellKnownFolderName.Inbox, filter, view);
      } catch (err) {
        this.logger.warn(`Starred getMessages: ${err.message}`);
        return { items: [], total: 0 };
      }
    } else {
      result = await this.service.FindItems(resolvedFolder, view);
    }

    const items: Partial<MailMessage>[] = result.Items.map((item: any) => ({
      id:             this.encodeId(resolvedId, item.Id?.UniqueId ?? ''),
      subject:        item.Subject       ?? '(No Subject)',
      from:           this.getFrom(item),
      receivedAt:     this.toJsDate(item.DateTimeReceived),
      isRead:         item.IsRead         ?? false,
      hasAttachments: item.HasAttachments  ?? false,
      preview:        '',
      isStarred:      this.isItemStarred(item),
    }));

    return { items, total: result.TotalCount ?? 0 };
  }

  async getMessage(id: string): Promise<MailMessage> {
    if (!this.service) throw new Error('EWS service not connected');

    const { itemId } = this.decodeId(id);
    const message    = await EmailMessage.Bind(
      this.service,
      new ItemId(itemId),
      DETAIL_PROPS,
    );

    if (!(message as any).IsRead) {
      (message as any).IsRead = true;
      await message.Update(ConflictResolutionMode.AlwaysOverwrite);
    }

    const bodyText = message.Body?.Text ?? '';

    return {
      id,
      subject:        message.Subject ?? '(No Subject)',
      from:           { name: message.From?.Name ?? '', email: message.From?.Address ?? '' },
      to:             this.getRecipients(message.ToRecipients),
      cc:             this.getRecipients(message.CcRecipients),
      receivedAt:     this.toJsDate(message.DateTimeReceived),
      body:           bodyText,
      isHtml:         message.Body?.BodyType === BodyType.HTML,
      hasAttachments: message.HasAttachments ?? false,
      isRead:         true,
      isStarred:      this.isItemStarred(message),
      preview:        bodyText.substring(0, 150),
    };
  }

  // ─── Send ─────────────────────────────────────────────────────────────────

  async sendMessage(options: SendMailOptions): Promise<{ success: boolean; messageId?: string }> {
    if (!this.service) throw new Error('EWS service not connected');
    if (!this.credentials) throw new Error('SMTP credentials not available');

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

    const info = await this.smtpSenderService.sendMail(
      this.credentials,
      mailOptions,
    );

    // Save a copy to Sent Items using EWS (do not re-send)
    try {
      const message   = new EmailMessage(this.service);
      message.Subject = options.subject ?? '';
      message.Body    = new MessageBody(
        options.html ? BodyType.HTML : BodyType.Text,
        options.html ?? options.text ?? '',
      );

      if (this.email) {
        const fromAddr = new EmailAddress(this.email);
        fromAddr.RoutingType = 'SMTP';
        message.From = fromAddr;
      }

      for (const r of options.to ?? []) {
        const addr = this.toEmailAddress(r);
        if (addr) message.ToRecipients.Add(addr);
      }
      for (const r of options.cc ?? []) {
        const addr = this.toEmailAddress(r);
        if (addr) message.CcRecipients.Add(addr);
      }
      for (const r of options.bcc ?? []) {
        const addr = this.toEmailAddress(r);
        if (addr) message.BccRecipients.Add(addr);
      }
      for (const r of options.replyTo ?? []) {
        const addr = this.toEmailAddress(r);
        if (addr) message.ReplyTo.Add(addr);
      }

      for (const att of options.attachments ?? []) {
        const file = message.Attachments.AddFileAttachment(att.filename, att.content);
        if (att.contentType) file.ContentType = att.contentType;
      }

      await message.Save(WellKnownFolderName.SentItems);
    } catch (error) {
      this.logger.warn(`Failed to save sent copy via EWS: ${error.message}`);
    }

    return { success: true, messageId: info?.messageId };
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  async search(
    query: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
    if (!this.service) throw new Error('EWS service not connected');

    const view = new ItemView(limit, (page - 1) * limit);
    view.OrderBy.Add(ItemSchema.DateTimeReceived, SortDirection.Descending);
    view.PropertySet = LIST_PROPS;

    // Tìm theo Subject và From.Name — tránh search Body (rất chậm trên Exchange on-premises)
    // Lưu ý: không có SenderName schema; dùng EmailMessageSchema.From không support ContainsSubstring
    // → chỉ search Subject; nếu muốn search sender thì dùng AQS string query (Exchange 2013+)
    const filter = new SearchFilter.ContainsSubstring(ItemSchema.Subject, query);

    try {
      const result = await this.service.FindItems(WellKnownFolderName.Inbox, filter, view);
      const items: Partial<MailMessage>[] = result.Items.map((item: any) => ({
        id:             this.encodeId('INBOX', item.Id?.UniqueId ?? ''),
        subject:        item.Subject       ?? '(No Subject)',
        from:           this.getFrom(item),
        receivedAt:     this.toJsDate(item.DateTimeReceived),
        isRead:         item.IsRead         ?? false,
        hasAttachments: item.HasAttachments  ?? false,
        isStarred:      this.isItemStarred(item),
      }));
      return { items, total: result.TotalCount ?? 0 };
    } catch (err) {
      this.logger.error(`Search error: ${err.message}`);
      return { items: [], total: 0 };
    }
  }

  // ─── Move ─────────────────────────────────────────────────────────────────

  async moveMessage(messageId: string, targetFolder: string): Promise<{ success: boolean }> {
    if (!this.service) throw new Error('EWS service not connected');

    const { itemId } = this.decodeId(messageId);
    await this.service.MoveItems(
      [new ItemId(itemId)],
      this.toFolderId(this.resolveFolderName(targetFolder)),
    );
    return { success: true };
  }

  async moveMessagesBatch(ids: string[], targetFolder: string): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    await this.service.MoveItems(
      ids.map((id) => new ItemId(this.decodeId(id).itemId)),
      this.toFolderId(this.resolveFolderName(targetFolder)),
    );
  }

  async moveAllMessages(sourceFolder: string, targetFolder: string): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const source = this.resolveFolderName(sourceFolder);
    const target = this.resolveFolderName(targetFolder);
    let more     = true;

    while (more) {
      // Luôn query offset=0 — sau khi move items đã bị remove khỏi source
      const view = new ItemView(200, 0);
      view.PropertySet = new PropertySet(BasePropertySet.IdOnly);

      const result = await this.service.FindItems(source, view);
      if (!result.Items.length) break;

      await this.service.MoveItems(
        result.Items.map((item) => new ItemId(item.Id!.UniqueId)),
        this.toFolderId(target),
      );
      more = result.MoreAvailable ?? false;
    }
  }

  // ─── Mark read/unread ─────────────────────────────────────────────────────

  async markMessages(ids: string[], isRead: boolean): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const props = new PropertySet(BasePropertySet.IdOnly, EmailMessageSchema.IsRead);
    for (const id of ids) {
      const { itemId } = this.decodeId(id);
      const msg        = await EmailMessage.Bind(this.service, new ItemId(itemId), props);
      if ((msg as any).IsRead !== isRead) {
        (msg as any).IsRead = isRead;
        await msg.Update(ConflictResolutionMode.AlwaysOverwrite);
      }
    }
  }

  async markAllMessages(folder: string, isRead: boolean): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const resolved = this.resolveFolderName(folder);
    const props    = new PropertySet(BasePropertySet.IdOnly, EmailMessageSchema.IsRead);
    let offset     = 0;
    let more       = true;

    while (more) {
      const view = new ItemView(200, offset);
      view.PropertySet = props;

      const result = await this.service.FindItems(resolved, view);
      if (!result.Items.length) break;

      for (const item of result.Items) {
        const msg = await EmailMessage.Bind(this.service, new ItemId(item.Id!.UniqueId), props);
        if ((msg as any).IsRead !== isRead) {
          (msg as any).IsRead = isRead;
          await msg.Update(ConflictResolutionMode.AlwaysOverwrite);
        }
      }

      offset += result.Items.length;
      more    = result.MoreAvailable ?? false;
    }
  }

  // ─── Star / Unstar ────────────────────────────────────────────────────────

  async markMessagesStar(ids: string[], starred: boolean): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    for (const id of ids) {
      const { itemId } = this.decodeId(id);
      const message    = await EmailMessage.Bind(
        this.service,
        new ItemId(itemId),
        FLAG_ONLY_PROPS,
      );
      await this.setFlag(message, starred);
    }
  }

  async markAllMessagesStar(folder: string, starred: boolean): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const resolved = this.resolveFolderName(folder);
    let offset     = 0;
    let more       = true;

    while (more) {
      const view = new ItemView(200, offset);
      view.PropertySet = FLAG_ONLY_PROPS;

      const result = await this.service.FindItems(resolved, view);
      if (!result.Items.length) break;

      for (const item of result.Items) {
        const message = await EmailMessage.Bind(
          this.service,
          new ItemId(item.Id!.UniqueId),
          FLAG_ONLY_PROPS,
        );
        await this.setFlag(message, starred);
      }

      offset += result.Items.length;
      more    = result.MoreAvailable ?? false;
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async permanentlyDeleteMessages(ids: string[]): Promise<number> {
    if (!this.service) throw new Error('EWS service not connected');

    const response: ServiceResponseCollection<any> = await this.service.DeleteItems(
      ids.map((id) => new ItemId(this.decodeId(id).itemId)),
      DeleteMode.HardDelete,
      SendCancellationsMode.SendToNone,
      AffectedTaskOccurrence.AllOccurrences,
    );
    return response.Responses.filter((r) => r.ErrorCode === ServiceError.NoError).length;
  }

  async permanentlyDeleteAllMessages(folder: string): Promise<number> {
    if (!this.service) throw new Error('EWS service not connected');

    const resolved = this.resolveFolderName(folder);
    let offset     = 0;
    let more       = true;
    let deleted    = 0;

    while (more) {
      const view = new ItemView(200, offset);
      view.PropertySet = new PropertySet(BasePropertySet.IdOnly);

      const result = await this.service.FindItems(resolved, view);
      if (!result.Items.length) break;

      const response: ServiceResponseCollection<any> = await this.service.DeleteItems(
        result.Items.map((item) => new ItemId(item.Id!.UniqueId)),
        DeleteMode.HardDelete,
        SendCancellationsMode.SendToNone,
        AffectedTaskOccurrence.AllOccurrences,
      );

      deleted += response.Responses.filter((r) => r.ErrorCode === ServiceError.NoError).length;
      offset  += result.Items.length;
      more     = result.MoreAvailable ?? false;
    }

    return deleted;
  }
}


