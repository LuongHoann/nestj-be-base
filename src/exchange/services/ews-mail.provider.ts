import {
  Injectable,
  Scope,
  Inject,
  Logger,
  UnauthorizedException,
  BadRequestException,
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
  FolderTraversal,
  FolderView,
  Mailbox,
  ItemView,
  SearchFilter,
  LogicalOperator,
  SortDirection,
  PropertySet,
  BasePropertySet,
  Contact,
  ContactSchema,
  EmailMessage,
  EmailAddressKey,
  EmailAddress,
  MessageBody,
  BodyType,
  FolderSchema,
  EmailMessageSchema,
  ItemSchema,
  Item,
  ItemId,
  DeleteMode,
  SendCancellationsMode,
  AffectedTaskOccurrence,
  ConflictResolutionMode,
  ServiceResponseCollection,
  ServiceError,
  ExtendedPropertyDefinition,
  DefaultExtendedPropertySet,
  MapiPropertyType,
  PhoneNumberKey,
  PhysicalAddressKey,
  PhysicalAddressEntry,
  IOutParam,
  ConversationId,
  ConversationIndexedItemView,
  ConversationSchema,
  FileAttachment,
  ItemAttachment,
  Appointment,
  CalendarFolder,
  CalendarView,
  SendInvitationsMode,
  SendInvitationsOrCancellationsMode,
  DateTime,
  FindItemsResults,
  ContainmentMode,
  ComparisonMode,
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
  MailAttachmentMeta,
  MailMessage,
  SendMailOptions,
  SaveDraftOptions,
} from '../interfaces/mail-provider.interface';
import {
  ExchangeContact,
  ExchangeContactAddress,
  ExchangeNote,
  ExchangeSearchResult,
} from '../interfaces/contact-note.interface';

(ExchangeService as any).XHRApi = new XhrApi();

// ─── MAPI Extended Properties cho Flag/Star ───────────────────────────────────
// Đây là cách chuẩn và đáng tin nhất với Exchange 2019 on-premises.
// EmailMessageSchema.Flag thường không đồng bộ đúng qua EWS.

/** PR_FLAG_STATUS (0x1090) — 0=NoFlag, 1=Flagged(Starred), 2=Complete */
const PR_FLAG_STATUS = new ExtendedPropertyDefinition(
  0x1090,
  MapiPropertyType.Integer,
);
/** PR_TODO_TITLE (0x0E2B) — thường là "Follow up" khi flag */
const PR_TODO_TITLE = new ExtendedPropertyDefinition(
  0x0e2b,
  MapiPropertyType.String,
);
/** PR_FOLLOWUP_ICON (0x1095) — màu flag, 6 = red (default Outlook star) */
const PR_FOLLOWUP_ICON = new ExtendedPropertyDefinition(
  0x1095,
  MapiPropertyType.Integer,
);
/** PR_SENDER_SMTP_ADDRESS (0x5D01) — SMTP thực của sender, không bị X500 */
const PR_SENDER_SMTP_ADDRESS = new ExtendedPropertyDefinition(
  0x5d01,
  MapiPropertyType.String,
);
/** PR_SENT_REPRESENTING_SMTP_ADDRESS (0x5D02) — SMTP của người được đại diện gửi */
const PR_SENT_REPRESENTING_SMTP_ADDRESS = new ExtendedPropertyDefinition(
  0x5d02,
  MapiPropertyType.String,
);

enum FlagStatus {
  NoFlag = 0,
  Flagged = 1,
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

// ─── Contact PropertySets ─────────────────────────────────────────────────────
// LƯU Ý QUAN TRỌNG: ContactSchema.EmailAddresses và ContactSchema.PhoneNumbers
// là complex dictionary properties — EWS KHÔNG hỗ trợ chúng trong FindItem.
// Phải dùng IndexedPropertyDefinition riêng lẻ (EmailAddress1/2/3, MobilePhone…)
// cho FindItem. ContactSchema.EmailAddresses/PhoneNumbers chỉ dùng được với Bind.

/** Dùng cho FindItem — chỉ dùng indexed properties được EWS hỗ trợ */
const CONTACT_LIST_PROPS = new PropertySet(
  BasePropertySet.IdOnly,
  ContactSchema.DisplayName,
  ContactSchema.GivenName,
  ContactSchema.Surname,
  ContactSchema.CompanyName,
  ContactSchema.JobTitle,
  ContactSchema.EmailAddress1,
  ContactSchema.EmailAddress2,
  ContactSchema.EmailAddress3,
  ContactSchema.MobilePhone,
  ContactSchema.BusinessPhone,
  ContactSchema.HomePhone,
);

/** Dùng cho Bind (GetItem) — có thể dùng complex properties */
const CONTACT_DETAIL_PROPS = new PropertySet(
  BasePropertySet.FirstClassProperties,
  ContactSchema.DisplayName,
  ContactSchema.GivenName,
  ContactSchema.Surname,
  ContactSchema.CompanyName,
  ContactSchema.JobTitle,
  ContactSchema.EmailAddresses,
  ContactSchema.PhoneNumbers,
  ContactSchema.PhysicalAddresses,
);

const NOTE_LIST_PROPS = new PropertySet(
  BasePropertySet.IdOnly,
  ItemSchema.Subject,
  ItemSchema.Body,
  ItemSchema.DateTimeCreated,
  ItemSchema.LastModifiedTime,
  ItemSchema.ItemClass,
);

// Lưu trữ các kết nối EWS dùng chung thay vì tạo mới liên tục ở từng Request gây lố concurrent limit.
const globalExchangeServices = new Map<string, ExchangeService>();

@Injectable({ scope: Scope.REQUEST })
export class EwsMailProvider implements IMailProvider {
  private readonly logger = new Logger(EwsMailProvider.name);
  private service: ExchangeService | null = null;
  private email: string | null = null;
  private credentials: {
    email: string;
    password: string;
    authIdentity?: string;
  } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly cache: DragonflyService,
    private readonly authService: ExchangeAuthService,
    private readonly smtpSenderService: SmtpSenderService,
    @Inject(REQUEST) private readonly request: any,
  ) { }

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
      url: this.configService.get<string>('EWS_URL') ?? '',
      version: this.configService.get<string>('EWS_VERSION') ?? 'Exchange2016',
      tlsRejectUnauthorized:
        this.configService.get<string>('EWS_TLS_REJECT_UNAUTHORIZED') !==
        'false',
    };
  }

  // ─── Connect / Disconnect ─────────────────────────────────────────────────

  async connect(): Promise<void> {
    const sessionToken = this.request.cookies?.['exchange_session'];
    if (!sessionToken)
      throw new UnauthorizedException('No session token provided');

    const creds = await this.authService.getCredentials(sessionToken);
    if (!creds) throw new UnauthorizedException('Session expired or invalid');
    if (!creds.password)
      throw new UnauthorizedException('Password not found in credentials');

    this.email = creds.email;
    this.credentials = {
      email: creds.email,
      password: creds.password,
      authIdentity: creds.authIdentity,
    };

    const cfg = this.ewsConfig;
    if (!cfg.url) throw new Error('EWS_URL is not configured');

    if (!cfg.tlsRejectUnauthorized) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    // Exchange 2019 on-premises tương thích với ExchangeVersion.Exchange2016
    const version =
      ExchangeVersion[cfg.version as keyof typeof ExchangeVersion] ??
      ExchangeVersion.Exchange2016;

    // Kiểm tra global service cache để tránh tạo quá nhiều connections (lỗi concurrent limit)
    let service = globalExchangeServices.get(creds.email);

    if (!service) {
      service = new ExchangeService(version);
      globalExchangeServices.set(creds.email, service);
    }

    // Luôn cập nhật endpoint và credentials hiện tại để tránh tái sử dụng phiên
    // EWS cũ với password đã lỗi thời sau khi user đăng nhập lại.
    service.Url = new Uri(cfg.url);
    service.Credentials = new WebCredentials(
      creds.authIdentity || creds.email,
      creds.password,
    );

    this.service = service;
  }

  async disconnect(): Promise<void> {
    // Không cần set service = null nữa vì ta muốn giữ map để tái sử dụng connection
    this.service = null;
    this.email = null;
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

  private toFolderId(folder: WellKnownFolderName, mailbox?: string): FolderId {
    if (mailbox) {
      return new FolderId(folder, new Mailbox(mailbox));
    }
    return new FolderId(folder);
  }

  // ─── ID helpers ───────────────────────────────────────────────────────────

  private encodeId(folder: string, itemId: string, mailbox?: string): string {
    const parts = [folder, itemId];
    if (mailbox) parts.push(mailbox);
    return Buffer.from(parts.join('::')).toString('base64');
  }

  private decodeId(id: string): {
    folder: string;
    itemId: string;
    mailbox?: string;
  } {
    const decoded = Buffer.from(id, 'base64').toString('utf8');
    const parts = decoded.split('::');
    return {
      folder: parts[0],
      itemId: parts[1],
      mailbox: parts[2] || undefined,
    };
  }

  private encodeContactId(itemId: string): string {
    return Buffer.from(`CONTACTS:${itemId}`).toString('base64');
  }

  private decodeContactId(id: string): string {
    const decoded = Buffer.from(id, 'base64').toString('utf8');
    if (!decoded.startsWith('CONTACTS:')) return decoded;
    return decoded.slice('CONTACTS:'.length);
  }

  private encodeNoteId(itemId: string): string {
    return Buffer.from(`NOTES:${itemId}`).toString('base64');
  }

  private decodeNoteId(id: string): string {
    const decoded = Buffer.from(id, 'base64').toString('utf8');
    if (!decoded.startsWith('NOTES:')) return decoded;
    return decoded.slice('NOTES:'.length);
  }

  private normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  /**
   * Lấy email chính từ Contact.
   * Hỗ trợ cả 2 trường hợp:
   *   - Contact đến từ Bind (có EmailAddresses dictionary đầy đủ)
   *   - Contact đến từ FindItems (có IndexedProperty EmailAddress1/2/3)
   */
  private getContactPrimaryEmail(contact: Contact): string {
    try {
      // Thử cách 1: lấy từ EmailAddresses dictionary (khả dụng sau Bind)
      if (contact.EmailAddresses) {
        const out1: IOutParam<EmailAddress> = { outValue: null as any };
        const out2: IOutParam<EmailAddress> = { outValue: null as any };
        const out3: IOutParam<EmailAddress> = { outValue: null as any };
        contact.EmailAddresses.TryGetValue(EmailAddressKey.EmailAddress1, out1);
        contact.EmailAddresses.TryGetValue(EmailAddressKey.EmailAddress2, out2);
        contact.EmailAddresses.TryGetValue(EmailAddressKey.EmailAddress3, out3);
        const addr =
          out1.outValue?.Address ||
          out2.outValue?.Address ||
          out3.outValue?.Address;
        if (addr) return addr;
      }
    } catch {
      // fallthrough
    }
    try {
      // Thử cách 2: lấy trực tiếp từ indexed property (khả dụng sau FindItems với CONTACT_LIST_PROPS)
      const rawContact = contact as any;
      const e1 = rawContact['EmailAddress1'];
      const e2 = rawContact['EmailAddress2'];
      const e3 = rawContact['EmailAddress3'];
      // Indexed property trả về EmailAddressEntry hoặc string tùy version
      const extract = (v: any): string => {
        if (!v) return '';
        if (typeof v === 'string') return v;
        return v.Address || v.SmtpAddress || '';
      };
      return extract(e1) || extract(e2) || extract(e3) || '';
    } catch {
      return '';
    }
  }

  /**
   * Lấy phone chính từ Contact.
   * Hỗ trợ cả 2 trường hợp:
   *   - Contact đến từ Bind (có PhoneNumbers dictionary đầy đủ)
   *   - Contact đến từ FindItems (có IndexedProperty MobilePhone/BusinessPhone/HomePhone)
   */
  private getContactPrimaryPhone(contact: Contact): string {
    try {
      // Thử cách 1: lấy từ PhoneNumbers dictionary (khả dụng sau Bind)
      if (contact.PhoneNumbers) {
        const mobileOut: IOutParam<string> = { outValue: null as any };
        const bizOut: IOutParam<string> = { outValue: null as any };
        const homeOut: IOutParam<string> = { outValue: null as any };
        contact.PhoneNumbers.TryGetValue(PhoneNumberKey.MobilePhone, mobileOut);
        contact.PhoneNumbers.TryGetValue(PhoneNumberKey.BusinessPhone, bizOut);
        contact.PhoneNumbers.TryGetValue(PhoneNumberKey.HomePhone, homeOut);
        const phone = mobileOut.outValue || bizOut.outValue || homeOut.outValue;
        if (phone) return phone;
      }
    } catch {
      // fallthrough
    }
    try {
      // Thử cách 2: lấy từ indexed property (khả dụng sau FindItems)
      const rawContact = contact as any;
      const mobile = rawContact['MobilePhone'];
      const business = rawContact['BusinessPhone'];
      const home = rawContact['HomePhone'];
      const extract = (v: any): string => {
        if (!v) return '';
        if (typeof v === 'string') return v;
        return v.PhoneNumber || String(v) || '';
      };
      return extract(mobile) || extract(business) || extract(home) || '';
    } catch {
      return '';
    }
  }

  private mapContactAddress(
    entry: PhysicalAddressEntry | null,
  ): ExchangeContactAddress | undefined {
    if (!entry) return undefined;
    const address: ExchangeContactAddress = {
      street: entry.Street ?? '',
      city: entry.City ?? '',
      state: entry.State ?? '',
      postalCode: entry.PostalCode ?? '',
      country: entry.CountryOrRegion ?? '',
    };
    const hasValue = Object.values(address).some(
      (v) => (v ?? '').toString().trim() !== '',
    );
    return hasValue ? address : undefined;
  }

  private getContactPrimaryAddress(
    contact: Contact,
  ): ExchangeContactAddress | undefined {
    try {
      if (contact.PhysicalAddresses) {
        const outBiz: IOutParam<PhysicalAddressEntry> = {
          outValue: null as any,
        };
        const outHome: IOutParam<PhysicalAddressEntry> = {
          outValue: null as any,
        };
        const outOther: IOutParam<PhysicalAddressEntry> = {
          outValue: null as any,
        };
        contact.PhysicalAddresses.TryGetValue(
          PhysicalAddressKey.Business,
          outBiz,
        );
        contact.PhysicalAddresses.TryGetValue(PhysicalAddressKey.Home, outHome);
        contact.PhysicalAddresses.TryGetValue(
          PhysicalAddressKey.Other,
          outOther,
        );

        const entry = outBiz.outValue || outHome.outValue || outOther.outValue;
        return this.mapContactAddress(entry);
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  // ─── Type helpers ─────────────────────────────────────────────────────────

  private toJsDate(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value.ToDate === 'function') return value.ToDate();
    if (typeof value.ToISOString === 'function')
      return new Date(value.ToISOString());
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
    const extProps: any[] =
      item?.ExtendedProperties?.items ?? item?.ExtendedProperties ?? [];
    for (const ep of extProps) {
      const tag = ep?.PropertyDefinition?.Tag ?? ep?.Tag;
      // 0x5D01 = PR_SENDER_SMTP_ADDRESS, 0x5D02 = PR_SENT_REPRESENTING_SMTP_ADDRESS
      if ((tag === 0x5d01 || tag === 0x5d02) && ep.Value) {
        return String(ep.Value);
      }
    }
    return '';
  }

  private getFrom(item: any): { name: string; email: string } {
    const raw = item?.From ?? item?.Sender;
    const name = raw?.Name ?? '';
    const rawAddress = raw?.Address ?? '';
    // Nếu address là X500 DN → thử lấy SMTP thực từ MAPI extended properties
    if (!rawAddress || this.isX500Address(rawAddress)) {
      const smtpFromMapi = this.getSenderSmtpFromExtProps(item);
      // Fallback: nếu MAPI cũng không có, trả về X500 gốc để không mất data
      return { name, email: smtpFromMapi || rawAddress };
    }

    return { name, email: rawAddress };
  }

  private getRecipients(collection: any): { name: string; email: string }[] {
    const items: any[] = collection?.items ?? collection?.Items ?? [];
    return items.map((a: any) => {
      const addr = a.Address ?? '';
      const name = a.Name ?? '';

      // Nếu là X500 DN mà không có name, ta vẫn giữ nguyên addr nguyên bản để không mất dữ liệu
      // Thông thường EWS sẽ trả về cả Name (hiển thị) và Address (X500)
      return {
        name: name,
        email: addr,
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
   * Set/unset flag trên message qua MAPI extended property PR_FLAG_STATUS.
   * Chỉ dùng PR_FLAG_STATUS đơn lẻ — tránh lỗi "invalid extended property combination"
   * khi Exchange 2019 on-prem từ chối tổ hợp PR_FLAG_STATUS + PR_TODO_TITLE + PR_FOLLOWUP_ICON.
   */
  private async setFlag(
    message: EmailMessage,
    starred: boolean,
    minimal = false,
  ): Promise<void> {
    if (minimal) {
      // Chế độ tối giản: chỉ set PR_FLAG_STATUS — Exchange 2019 on-prem chấp nhận
      message.SetExtendedProperty(
        PR_FLAG_STATUS,
        starred ? FlagStatus.Flagged : FlagStatus.NoFlag,
      );
    } else {
      // Chế độ đầy đủ: set cả 3 properties như Outlook client
      if (starred) {
        message.SetExtendedProperty(PR_FLAG_STATUS, FlagStatus.Flagged);
        message.SetExtendedProperty(PR_TODO_TITLE, 'Follow up');
        message.SetExtendedProperty(PR_FOLLOWUP_ICON, 6);
      } else {
        message.SetExtendedProperty(PR_FLAG_STATUS, FlagStatus.NoFlag);
        message.SetExtendedProperty(PR_TODO_TITLE, '');
        message.SetExtendedProperty(PR_FOLLOWUP_ICON, 0);
      }
    }
    await message.Update(ConflictResolutionMode.AlwaysOverwrite);
  }

  // ─── Folders ──────────────────────────────────────────────────────────────

  async getFolders(): Promise<MailFolder[]> {
    if (!this.service) throw new Error('EWS service not connected');

    // 1. Lấy toàn bộ folder từ MsgFolderRoot
    const view = new FolderView(1000);
    view.Traversal = FolderTraversal.Deep;
    view.PropertySet = new PropertySet(
      BasePropertySet.IdOnly,
      FolderSchema.DisplayName,
      FolderSchema.ParentFolderId,
      FolderSchema.TotalCount,
      FolderSchema.UnreadCount,
    );
    
    const findResults = await this.service.FindFolders(
      WellKnownFolderName.MsgFolderRoot,
      view,
    );

    // 2. Map sang MailFolder phẳng
    const flatFolders: MailFolder[] = findResults.Folders.map(f => {
      const wellKnownName = this.getWellKnownNameFromDisplayName(f.DisplayName);
      const isSystem = !!wellKnownName;
      
      let unread = 0;
      let total = 0;
      
      try {
        unread = (f as any).UnreadCount ?? 0;
      } catch (e) {
        // Một số folder như Calendar/Contacts có thể không trả về UnreadCount
      }
      
      try {
        total = (f as any).TotalCount ?? 0;
      } catch (e) {
      }
      
      return {
        // Nếu là system folder, dùng chính constant ID (inbox, sent...) để FE nhận diện được Icon/Label
        id: isSystem ? wellKnownName : f.Id.UniqueId,
        name: f.DisplayName,
        type: wellKnownName || 'user_created',
        parentId: f.ParentFolderId?.UniqueId,
        isSystem,
        unreadCount: unread,
        totalCount: total,
      };
    });

    // 3. Xây dựng cấu trúc cây
    const uniqueIdToFolderId = new Map<string, string>();
    findResults.Folders.forEach(f => {
      const wellKnownName = this.getWellKnownNameFromDisplayName(f.DisplayName);
      uniqueIdToFolderId.set(f.Id.UniqueId, wellKnownName || f.Id.UniqueId);
    });

    const tree = this.buildFolderTree(flatFolders, uniqueIdToFolderId);

    // 4. Thêm folder ảo "Starred" vào đầu danh sách system (nếu không ở trong cây EWS)
    const starredCounts = await this.getStarredCounts();
    const starredFolder: MailFolder = {
      id: 'Starred',
      name: 'Có gắn dấu sao',
      type: 'starred',
      isSystem: true,
      unreadCount: starredCounts.unread,
      totalCount: starredCounts.total,
    };

    return [starredFolder, ...tree];
  }

  private getWellKnownNameFromDisplayName(displayName: string): string | null {
    const lowerName = displayName.toLowerCase();
    for (const folder of MAIL_FOLDERS) {
      if (
        folder.aliases.some(alias => alias.toLowerCase() === lowerName) ||
        folder.name.toLowerCase() === lowerName
      ) {
        return folder.type;
      }
    }
    return null;
  }

  private buildFolderTree(folders: MailFolder[], idMap: Map<string, string>): MailFolder[] {
    const map = new Map<string, MailFolder>();
    const roots: MailFolder[] = [];

    folders.forEach(f => {
      map.set(f.id, { ...f, children: [] });
    });

    folders.forEach(f => {
      const node = map.get(f.id)!;
      const mappedParentId = f.parentId ? idMap.get(f.parentId) : undefined;
      
      if (mappedParentId && map.has(mappedParentId)) {
        map.get(mappedParentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  async getFolderCounts(
    mailbox?: string,
  ): Promise<Record<string, { total: number; unread: number }>> {
    // Với logic động, chúng ta có thể gọi getFolders hoặc tối ưu bằng cách fetch riêng
    // Tuy nhiên để tương thích với MailService cũ, ta sẽ trả về map phẳng của các system folders
    const folders = await this.getFolders();
    const counts: Record<string, { total: number; unread: number }> = {};
    
    const flatten = (items: MailFolder[]) => {
      items.forEach(f => {
        if (f.isSystem) {
          counts[f.id] = { total: f.totalCount || 0, unread: f.unreadCount || 0 };
        }
        if (f.children) flatten(f.children);
      });
    };
    
    flatten(folders);
    return counts;
  }

  private async getStarredCounts(
    mailbox?: string,
  ): Promise<{ total: number; unread: number }> {
    if (!this.service) throw new Error('EWS service not connected');
    try {
      const countView = new ItemView(1, 0);
      // Dùng MAPI filter để tìm đúng flagged items
      const starredFilter = new SearchFilter.IsEqualTo(
        PR_FLAG_STATUS,
        FlagStatus.Flagged,
      );

      const totalResult = await this.service.FindItems(
        this.toFolderId(WellKnownFolderName.Inbox, mailbox),
        starredFilter,
        countView,
      );

      if (!totalResult.TotalCount) return { total: 0, unread: 0 };

      const unreadResult = await this.service.FindItems(
        this.toFolderId(WellKnownFolderName.Inbox, mailbox),
        new SearchFilter.SearchFilterCollection(LogicalOperator.And, [
          starredFilter,
          new SearchFilter.IsEqualTo(EmailMessageSchema.IsRead, false),
        ]),
        countView,
      );

      return {
        total: totalResult.TotalCount ?? 0,
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
    mailbox?: string,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
    if (!this.service) throw new Error('EWS service not connected');

    const resolvedId = resolveFolderId(folderId, folderId);
    const resolvedFolder = this.resolveFolderName(folderId);
    const offset = (page - 1) * limit;

    const view = new ItemView(limit, offset);
    view.OrderBy.Add(ItemSchema.DateTimeReceived, SortDirection.Descending);
    view.PropertySet = LIST_PROPS;

    let result: any;

    if (resolvedId === 'Starred') {
      try {
        const filter = new SearchFilter.IsEqualTo(
          PR_FLAG_STATUS,
          FlagStatus.Flagged,
        );
        result = await this.service.FindItems(
          this.toFolderId(WellKnownFolderName.Inbox, mailbox),
          filter,
          view,
        );
      } catch (err) {
        this.logger.warn(`Starred getMessages: ${err.message}`);
        return { items: [], total: 0 };
      }
    } else {
      result = await this.service.FindItems(
        this.toFolderId(resolvedFolder, mailbox),
        view,
      );
    }

    const items: Partial<MailMessage>[] = result.Items.map((item: any) => ({
      id: this.encodeId(resolvedId, item.Id?.UniqueId ?? '', mailbox),
      subject: item.Subject ?? '(không có chủ đề)',
      from: this.getFrom(item),
      receivedAt: this.toJsDate(item.DateTimeReceived),
      isRead: item.IsRead ?? false,
      hasAttachments: item.HasAttachments ?? false,
      preview: '',
      isStarred: this.isItemStarred(item),
    }));

    return { items, total: result.TotalCount ?? 0 };
  }

  async getMessage(id: string): Promise<MailMessage> {
    if (!this.service) throw new Error('EWS service not connected');

    const { itemId } = this.decodeId(id);
    let message: EmailMessage;
    try {
      message = await EmailMessage.Bind(
        this.service,
        new ItemId(itemId),
        DETAIL_PROPS,
      );
    } catch (err) {
      this.logger.warn(
        `getMessage fallback without extended properties: ${err?.message}`,
      );
      const basicProps = new PropertySet(BasePropertySet.FirstClassProperties);
      message = await EmailMessage.Bind(
        this.service,
        new ItemId(itemId),
        basicProps,
      );
    }

    if (!(message as any).IsRead) {
      (message as any).IsRead = true;
      await message.Update(ConflictResolutionMode.AlwaysOverwrite);
    }

    const bodyText = message.Body?.Text ?? '';
    const attachments = this.extractAttachmentMetas(message);

    this.logger.log(
      `[getMessage] bodyText length: ${bodyText.length}, sample: ${bodyText.substring(0, 50).trim()}`,
    );

    // Đọc ConversationId nếu có — dùng để fetch toàn bộ luồng thư hội thoại
    const rawConvId = (message as any).ConversationId?.UniqueId as
      | string
      | undefined;

    return {
      id,
      subject: message.Subject ?? '(không có chủ đề)',
      from: {
        name: message.From?.Name ?? '',
        email: message.From?.Address ?? '',
      },
      to: this.getRecipients(message.ToRecipients),
      cc: this.getRecipients(message.CcRecipients),
      bcc: this.getRecipients(message.BccRecipients),
      receivedAt: this.toJsDate(message.DateTimeReceived),
      body: bodyText,
      isHtml: message.Body?.BodyType === BodyType.HTML,
      hasAttachments: message.HasAttachments ?? false,
      isRead: true,
      isStarred: this.isItemStarred(message),
      preview: bodyText.substring(0, 150),
      conversationId: rawConvId,
      attachments,
    };
  }

  private extractAttachmentMetas(message: EmailMessage): MailAttachmentMeta[] {
    const items: any[] =
      (message as any)?.Attachments?.items ??
      (message as any)?.Attachments ??
      [];

    return items.map((att: any, index: number) => ({
      index,
      filename: att?.Name || `attachment-${index + 1}`,
      contentType: att?.ContentType || 'application/octet-stream',
      size: Number(att?.Size || 0),
    }));
  }

  async downloadAttachment(
    messageId: string,
    index: number,
  ): Promise<{
    filename: string;
    contentType: string;
    size: number;
    content: Buffer;
  }> {
    if (!this.service) throw new Error('EWS service not connected');

    const { itemId } = this.decodeId(messageId);
    const message = await EmailMessage.Bind(
      this.service,
      new ItemId(itemId),
      new PropertySet(BasePropertySet.FirstClassProperties),
    );

    const attachments: any[] =
      (message as any)?.Attachments?.items ??
      (message as any)?.Attachments ??
      [];

    if (!Number.isInteger(index) || index < 0 || index >= attachments.length) {
      throw new BadRequestException('Attachment index khong hop le');
    }

    const attachment = attachments[index];
    if (typeof attachment?.Load === 'function') {
      await attachment.Load();
    }

    if (attachment instanceof ItemAttachment) {
      throw new BadRequestException(
        'Attachment dang item-embedded, chua ho tro download',
      );
    }

    if (!(attachment instanceof FileAttachment)) {
      throw new BadRequestException('Loai attachment khong ho tro');
    }

    const base64Content = attachment.Base64Content;
    if (!base64Content) {
      throw new BadRequestException('Attachment content khong ton tai');
    }

    const content = Buffer.from(base64Content, 'base64');

    return {
      filename: attachment.Name || `attachment-${index + 1}`,
      contentType: attachment.ContentType || 'application/octet-stream',
      size: Number(attachment.Size || content.length || 0),
      content,
    };
  }

  // ─── Conversation Thread ───────────────────────────────────────────────────

  /**
   * Lấy toàn bộ email trong cùng luồng hội thoại từ messageId gốc.
   * Luồng: messageId → Bind email → Lấy ConversationId → FindItems theo ConversationId.
   * Tương thích Exchange 2019 on-premises.
   * @param messageId - Composite ID (base64) của email gốc cần tìm thread
   * @param maxItems  - Số lượng email tối đa trả về (mặc định 50)
   */
  async getConversationMessages(
    messageId: string,
    maxItems: number = 50,
  ): Promise<{
    items: Partial<
      import('../interfaces/mail-provider.interface').MailMessage
    >[];
    total: number;
    hasMore: boolean;
  }> {
    if (!this.service) {
      throw new Error('EWS service not connected');
    }

    try {
      // 1️⃣ Bind mail gốc để lấy ConversationId
      const { itemId } = this.decodeId(messageId);

      const baseMessage = await EmailMessage.Bind(
        this.service,
        new ItemId(itemId),
        new PropertySet(BasePropertySet.IdOnly, ItemSchema.ConversationId),
      );

      const conversationId = (baseMessage as any).ConversationId?.UniqueId;

      if (!conversationId) {
        return { items: [], total: 0, hasMore: false };
      }

      const filter = new SearchFilter.IsEqualTo(
        ItemSchema.ConversationId,
        conversationId,
      );

      const allRawItems: { item: EmailMessage; folderLabel: string }[] = [];

      // 3️⃣ Search từng folder — lưu kèm folder label
      const folderDefs = [
        { wellKnown: WellKnownFolderName.Inbox, label: 'INBOX' },
        { wellKnown: WellKnownFolderName.SentItems, label: 'Sent Items' },
        { wellKnown: WellKnownFolderName.Drafts, label: 'Drafts' },
      ];

      for (const folderDef of folderDefs) {
        try {
          const folderId = new FolderId(folderDef.wellKnown);

          const view = new ItemView(maxItems);
          view.PropertySet = new PropertySet(
            BasePropertySet.IdOnly,
            EmailMessageSchema.Subject,
            ItemSchema.DateTimeReceived,
            EmailMessageSchema.From,
            ItemSchema.HasAttachments,
            EmailMessageSchema.IsRead,
          );
          view.OrderBy.Add(
            ItemSchema.DateTimeReceived,
            SortDirection.Ascending,
          );

          const result = await this.service.FindItems(folderId, filter, view);
          const found = (result?.Items ?? []).filter(
            (i) => i instanceof EmailMessage,
          );
          this.logger.log(
            `[ConvThread] ${folderDef.label}: tìm thấy ${found.length} item`,
          );
          allRawItems.push(
            ...found.map((item) => ({ item, folderLabel: folderDef.label })),
          );
        } catch (folderErr) {
          this.logger.warn(
            `[ConvThread] Lỗi ${folderDef.label}: ${folderErr?.message}`,
          );
        }
      }

      if (!allRawItems.length) {
        return { items: [], total: 0, hasMore: false };
      }

      // 4️⃣ Deduplicate theo UniqueId — giữ lại folder label tương ứng
      const uniqueMap = new Map<
        string,
        { item: EmailMessage; folderLabel: string }
      >();
      for (const entry of allRawItems) {
        const id = entry.item.Id?.UniqueId;
        if (id && !uniqueMap.has(id)) uniqueMap.set(id, entry);
      }

      const uniqueEntries = Array.from(uniqueMap.values());

      // 5️⃣ Bind song song để lấy full body — dùng đúng folder label khi encodeId
      const detailed = await Promise.all(
        uniqueEntries.map(async ({ item, folderLabel }) => {
          const full = await EmailMessage.Bind(
            this.service!,
            item.Id,
            new PropertySet(BasePropertySet.FirstClassProperties),
          );

          const compositeId = full.Id?.UniqueId
            ? this.encodeId(folderLabel, full.Id.UniqueId)
            : '';

          const bodyText = full.Body?.Text ?? '';
          return {
            id: compositeId,
            subject: full.Subject ?? '(không có chủ đề)',
            from: {
              name: full.From?.Name ?? '',
              email: full.From?.Address ?? '',
            },
            to: this.getRecipients(full.ToRecipients),
            cc: this.getRecipients(full.CcRecipients),
            receivedAt: this.toJsDate(full.DateTimeReceived),
            body: bodyText,
            isHtml: full.Body?.BodyType === BodyType.HTML,
            hasAttachments: full.HasAttachments ?? false,
            isRead: (full as any).IsRead ?? false,
            isStarred: false,
            preview: bodyText.substring(0, 200),
            conversationId,
          };
        }),
      );

      // 6️⃣ Sort theo thời gian
      detailed.sort((a, b) => {
        const tA = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
        const tB = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
        return tA - tB;
      });

      return {
        items: detailed.slice(0, maxItems),
        total: detailed.length,
        hasMore: detailed.length > maxItems,
      };
    } catch (error) {
      this.logger.error(`[ConvThread] Error: ${error?.message}`);
      return { items: [], total: 0, hasMore: false };
    }
  }
  // ─── Send ─────────────────────────────────────────────────────────────────

  async saveDraft(
    options: SaveDraftOptions,
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.service) throw new Error('EWS service not connected');

    this.logger.debug(
      `[SaveDraft] Payload: ${JSON.stringify({
        subject: options.subject,
        htmlLen: options.html?.length,
        textLen: options.text?.length,
        htmlSample: options.html?.substring(0, 50),
      })}`,
    );

    const message = new EmailMessage(this.service);
    message.Subject = options.subject ?? '';
    const bodyString = options.html ?? options.text ?? '';
    const encodedBody = this.xmlEncodeForSoap(bodyString);

    message.Body = new MessageBody(
      options.html ? BodyType.HTML : BodyType.Text,
      encodedBody,
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
      const file = message.Attachments.AddFileAttachment(
        att.filename,
        att.content,
      );
      if (att.contentType) file.ContentType = att.contentType;
    }

    await message.Save(WellKnownFolderName.Drafts);

    const messageId = message.Id?.UniqueId
      ? this.encodeId('Drafts', message.Id.UniqueId)
      : undefined;

    return { success: true, messageId };
  }

  async sendMessage(
    options: SendMailOptions,
  ): Promise<{ success: boolean; messageId?: string }> {
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
      const message = new EmailMessage(this.service);
      message.Subject = options.subject ?? '';
      const bodyString = options.html ?? options.text ?? '';
      const encodedBody = this.xmlEncodeForSoap(bodyString);

      message.Body = new MessageBody(
        options.html ? BodyType.HTML : BodyType.Text,
        encodedBody,
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
        const file = message.Attachments.AddFileAttachment(
          att.filename,
          att.content,
        );
        if (att.contentType) file.ContentType = att.contentType;
      }

      await message.Save(WellKnownFolderName.SentItems);
    } catch (error) {
      this.logger.warn(`Failed to save sent copy via EWS: ${error.message}`);
    }

    return { success: true, messageId: info?.messageId };
  }

  // ─── Reply ─────────────────────────────────────────────────────────────────

  /**
   * Trả lời một email. Sử dụng EWS CreateReply để giữ nguyên luồng hội thoại,
   * các header quan trọng như In-Reply-To, References sẽ được Exchange tự xử lý.
   * @param messageId - ID mã hoá của thư gốc cần trả lời
   * @param html - Nội dung trả lời định dạng HTML (tuỳ chọn)
   * @param text - Nội dung trả lời dạng plain text (tuỳ chọn)
   * @param replyAll - true để reply tất cả, false/undefined để reply người gửi
   * @param attachments - Tệp đính kèm mới thêm vào (tuỳ chọn)
   */
  async replyMessage(options: {
    messageId: string;
    html?: string;
    text?: string;
    replyAll?: boolean;
    attachments?: Array<{
      filename: string;
      contentType?: string;
      content: string;
    }>;
  }): Promise<{ success: boolean }> {
    if (!this.service) throw new Error('EWS service not connected');

    const { itemId } = this.decodeId(options.messageId);

    // ── Bước 0: Bind thư gốc để lấy thông tin hiển thị (From, Subject, Date) ──
    const original = await EmailMessage.Bind(
      this.service,
      new ItemId(itemId),
      new PropertySet(BasePropertySet.FirstClassProperties),
    );

    // ── Bước 1: Ghép nội dung body ────────────────────────────────────────────
    const userHtml = options.html
      ? options.html
      : options.text
        ? `<p>${options.text.replace(/\n/g, '<br>')}</p>`
        : '';

    // Định dạng ngày theo kiểu Outlook
    let sentDateStr = '';
    try {
      const m = (original as any).DateTimeSent?.getMomentDate?.();
      if (m) sentDateStr = m.format('dddd, MMMM D, YYYY h:mm:ss A');
    } catch (_) {
      sentDateStr = String((original as any).DateTimeSent ?? '');
    }

    const fromDisplay = original.From?.Name || original.From?.Address || '';
    const toDisplay = this.getRecipientsStr(original.ToRecipients);
    const origSubject = original.Subject ?? '';

    // Tạo bodyPrefix HTML: nội dung người dùng + header trích dẫn thư gốc kiểu Outlook
    const bodyPrefixHtml = [
      `<div>${userHtml}</div>`,
      `<br>`,
      `<hr style="border:none;border-top:1px solid #ccc;margin:8px 0;">`,
      `<div style="font-size:12px;color:#333;line-height:1.8;">`,
      `  <b>From:</b> ${this.escHtml(fromDisplay)}<br>`,
      `  <b>Sent:</b> ${this.escHtml(sentDateStr)}<br>`,
      `  <b>To:</b> ${this.escHtml(toDisplay)}<br>`,
      `  <b>Subject:</b> ${this.escHtml(origSubject)}`,
      `</div>`,
    ].join('\n');

    // ⚠️ XML-encode bắt buộc vì EwsServiceXmlWriter.WriteValue() không tự escape.
    // Nếu không encode: <div>, <p>, <br>... phá vỡ SOAP XML → Exchange báo schema error.
    const bodyPrefixEncoded = this.xmlEncodeForSoap(bodyPrefixHtml);

    this.logger.log(
      `[Reply] userHtml length=${userHtml.length}, bodyPrefixEncoded length=${bodyPrefixEncoded.length}`,
    );

    // ── Bước 2: Bind IdOnly → CreateReply → set BodyPrefix → gửi thẳng ────────
    const baseMsg = await EmailMessage.Bind(
      this.service,
      new ItemId(itemId),
      new PropertySet(BasePropertySet.IdOnly),
    );

    // CreateReply tự xử lý: In-Reply-To, References, Subject "RE:", ToRecipients
    const responseMsg = baseMsg.CreateReply(options.replyAll ?? false);

    // Set BodyPrefix đã XML-encode → SOAP hợp lệ, Exchange decode lại HTML đúng
    responseMsg.BodyPrefix = new MessageBody(BodyType.HTML, bodyPrefixEncoded);

    // Đính kèm tệp nếu có
    for (const att of options.attachments ?? []) {
      try {
        const file = (responseMsg as any).Attachments?.AddFileAttachment?.(
          att.filename,
          att.content,
        );
        if (file && att.contentType) file.ContentType = att.contentType;
      } catch (_) { }
    }

    // Gửi thẳng, lưu bản sao vào SentItems — không qua bước Save/FindItems/Bind
    await responseMsg.SendAndSaveCopy(WellKnownFolderName.SentItems);

    this.logger.log(
      `[Reply] Gửi reply thành công cho messageId=${options.messageId}`,
    );
    return { success: true };
  }

  /**
   * XML-encode HTML content để pass an toàn vào ews-javascript-api.
   * Library KHÔNG tự escape → phải encode thủ công trước khi gọi MessageBody(HTML, ...).
   * Exchange sẽ XML-decode lại khi xử lý SOAP request và lưu HTML đúng vào mailbox.
   */
  private xmlEncodeForSoap(html: string): string {
    if (!html) return '';
    return html
      .replace(/&/g, '&amp;') // & phải replace TRƯỚC
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /** Escape ký tự HTML đặc biệt để an toàn khi nhúng vào HTML */
  private escHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Lấy tên/email người nhận dạng "Name; Name2" */
  private getRecipientsStr(recipients: any): string {
    if (!recipients) return '';
    const out: string[] = [];
    try {
      for (const r of recipients.GetEnumerator?.() ?? []) {
        out.push(r.Name || r.Address || '');
      }
    } catch (_) { }
    return out.join('; ');
  }

  // ─── Forward ───────────────────────────────────────────────────────────────

  /**
   * Chuyển tiếp email đến người nhận khác. Sử dụng EWS CreateForward để
   * đảm bảo tệp đính kèm gốc và nội dung gốc được giữ nguyên vẹn.
   * @param messageId - ID mã hoá của thư gốc cần chuyển tiếp
   * @param to - Danh sách email người nhận
   * @param cc - Danh sách CC (tuỳ chọn)
   * @param bcc - Danh sách BCC (tuỳ chọn)
   * @param html - Lời nhắn thêm khi forward (tuỳ chọn)
   * @param text - Lời nhắn dạng text (tuỳ chọn)
   * @param attachments - Tệp đính kèm bổ sung (tuỳ chọn)
   */
  async forwardMessage(options: {
    messageId: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    html?: string;
    text?: string;
    attachments?: Array<{
      filename: string;
      contentType?: string;
      content: string;
    }>;
  }): Promise<{ success: boolean }> {
    if (!this.service) throw new Error('EWS service not connected');

    const { itemId } = this.decodeId(options.messageId);

    // ── Bước 1: Bind thư gốc để lấy thông tin hiển thị ở phần Header ────────
    const original = await EmailMessage.Bind(
      this.service,
      new ItemId(itemId),
      new PropertySet(BasePropertySet.FirstClassProperties),
    );

    const userHtml = options.html
      ? options.html
      : options.text
        ? `<p>${options.text.replace(/\n/g, '<br>')}</p>`
        : '';

    let sentDateStr = '';
    try {
      const m = (original as any).DateTimeSent?.getMomentDate?.();
      if (m) sentDateStr = m.format('dddd, MMMM D, YYYY h:mm:ss A');
    } catch (_) {
      sentDateStr = String((original as any).DateTimeSent ?? '');
    }

    const fromDisplay = original.From?.Name || original.From?.Address || '';
    const toDisplay = this.getRecipientsStr(original.ToRecipients);
    const origSubject = original.Subject ?? '';

    // HTML bodyPrefix: nội dung người dùng + block thông tin của thư được Forward
    const bodyPrefixHtml = [
      `<div>${userHtml}</div>`,
      `<br>`,
      `<div style="font-family: Arial, sans-serif; font-size: 13px;">`,
      `  <div style="margin-bottom: 4px;">---------- Forwarded message ---------</div>`,
      `  <div style="color: #333; line-height: 1.6;">`,
      `    <b>From:</b> ${this.escHtml(fromDisplay)}<br>`,
      `    <b>Date:</b> ${this.escHtml(sentDateStr)}<br>`,
      `    <b>Subject:</b> ${this.escHtml(origSubject)}<br>`,
      `    <b>To:</b> ${this.escHtml(toDisplay)}<br>`,
      `  </div>`,
      `</div><br>`,
    ].join('\n');

    // Chống lỗi Schema validation error bằng cách XML-Encode an toàn
    const bodyPrefixXmlEncoded = this.xmlEncodeForSoap(bodyPrefixHtml);

    // ── Bước 2: Bind IdOnly → CreateForward → set BodyPrefix ───────────────
    const baseMsg = await EmailMessage.Bind(
      this.service,
      new ItemId(itemId),
      new PropertySet(BasePropertySet.IdOnly),
    );

    const forwardMsg = baseMsg.CreateForward();

    // Thêm người nhận To
    for (const email of options.to) {
      const addr = this.toEmailAddress(email);
      if (addr) forwardMsg.ToRecipients.Add(addr);
    }

    // Thêm CC nếu có
    for (const email of options.cc ?? []) {
      const addr = this.toEmailAddress(email);
      if (addr) forwardMsg.CcRecipients.Add(addr);
    }

    // Thêm BCC nếu có
    for (const email of options.bcc ?? []) {
      const addr = this.toEmailAddress(email);
      if (addr) forwardMsg.BccRecipients.Add(addr);
    }

    // Truyền phần text HTML (đã được encode) vào BodyPrefix
    forwardMsg.BodyPrefix = new MessageBody(
      BodyType.HTML,
      bodyPrefixXmlEncoded,
    );

    // Đính kèm tệp bổ sung (nếu có) trực tiếp vào ResponseObject (có thể được xử lý ngầm bởi ews-javascript-api)
    for (const att of options.attachments ?? []) {
      try {
        const file = (forwardMsg as any).Attachments?.AddFileAttachment?.(
          att.filename,
          att.content,
        );
        if (file && att.contentType) file.ContentType = att.contentType;
      } catch (_) { }
    }

    // Gửi trực tiếp và lưu Sent Items, không cần Save() sang Draft để tránh race condition
    await forwardMsg.SendAndSaveCopy(WellKnownFolderName.SentItems);
    this.logger.log(
      `[Forward] Chuyển tiếp thành công cho messageId=${options.messageId}`,
    );
    return { success: true };
  }

  // Thêm interface để trả về cả query lẫn size filter
  private parseSizeFromQuery(query: string): {
    cleanQuery: string;
    sizeFilter: SearchFilter | null;
  } {
    let sizeFilter: SearchFilter | null = null;

    // Tìm và extract "size:[<>]Value[Unit]" ra khỏi query string
    const cleanQuery = query
      .replace(
        /\bsize:([<>])?(\d+)([a-zA-Z]+)?\b/gi,
        (match, op, val, unit) => {
          let bytes = parseInt(val, 10);
          const u = (unit || '').toLowerCase();

          if (u === 'mb') bytes *= 1024 * 1024;
          else if (u === 'kb') bytes *= 1024;

          // Tạo SearchFilter thay vì AQS string
          if (op === '>') {
            sizeFilter = new SearchFilter.IsGreaterThan(ItemSchema.Size, bytes);
          } else if (op === '<') {
            sizeFilter = new SearchFilter.IsLessThan(ItemSchema.Size, bytes);
          } else {
            // Không có operator -> mặc định tìm >= bytes
            sizeFilter = new SearchFilter.IsGreaterThanOrEqualTo(
              ItemSchema.Size,
              bytes,
            );
          }

          return ''; // Xoá phần size: ra khỏi AQS string
        },
      )
      .trim()
      .replace(/\s+/g, ' '); // Dọn khoảng trắng thừa

    return { cleanQuery, sizeFilter };
  }

  /**
   * Convert toàn bộ query string thành SearchFilter.
   * Hỗ trợ: has:attachment, is:unread, is:read, from:xxx, size:[<>]NNN[kb|mb]
   * Các từ khóa tự do còn lại (subject, body text...) dùng ContainsSubstring trên Subject.
   */
  private buildSearchFilter(query: string): SearchFilter | null {
    if (!query?.trim()) return null;

    const filters: SearchFilter[] = [];
    let remaining = query;

    // has:attachment
    if (/\bhas:attachment\b/i.test(remaining)) {
      filters.push(new SearchFilter.IsEqualTo(ItemSchema.HasAttachments, true));
      remaining = remaining.replace(/\bhas:attachment\b/gi, '').trim();
    }

    // is:unread
    if (/\bis:unread\b/i.test(remaining)) {
      filters.push(
        new SearchFilter.IsEqualTo(EmailMessageSchema.IsRead, false),
      );
      remaining = remaining.replace(/\bis:unread\b/gi, '').trim();
    }

    // is:read
    if (/\bis:read\b/i.test(remaining)) {
      filters.push(new SearchFilter.IsEqualTo(EmailMessageSchema.IsRead, true));
      remaining = remaining.replace(/\bis:read\b/gi, '').trim();
    }

    // from:xxx hoặc from:me
    const fromMatch = remaining.match(/\bfrom:("([^"]+)"|(\S+))/i);
    if (fromMatch) {
      const fromValue = fromMatch[2] ?? fromMatch[3]; // bên trong quotes hoặc không quotes
      const resolvedFrom =
        fromValue.toLowerCase() === 'me' ? this.email : fromValue;
      if (resolvedFrom) {
        filters.push(
          new SearchFilter.ContainsSubstring(
            EmailMessageSchema.From,
            resolvedFrom,
            ContainmentMode.Substring,
            ComparisonMode.IgnoreCase,
          ),
        );
      }
      remaining = remaining.replace(/\bfrom:("([^"]+)"|(\S+))/gi, '').trim();
    }

    // size:[<>]NNN[kb|mb]
    const sizeMatch = remaining.match(/\bsize:([<>])?(\d+)(kb|mb)?\b/i);
    if (sizeMatch) {
      const op = sizeMatch[1]; // '<' | '>' | undefined
      let bytes = parseInt(sizeMatch[2], 10);
      const unit = (sizeMatch[3] ?? '').toLowerCase();

      if (unit === 'mb') bytes *= 1024 * 1024;
      else if (unit === 'kb') bytes *= 1024;

      if (op === '>') {
        filters.push(new SearchFilter.IsGreaterThan(ItemSchema.Size, bytes));
      } else if (op === '<') {
        filters.push(new SearchFilter.IsLessThan(ItemSchema.Size, bytes));
      } else {
        filters.push(
          new SearchFilter.IsGreaterThanOrEqualTo(ItemSchema.Size, bytes),
        );
      }
      remaining = remaining
        .replace(/\bsize:([<>])?(\d+)(kb|mb)?\b/gi, '')
        .trim();
    }

    // Phần text tự do còn lại -> tìm trong Subject
    const freeText = remaining.replace(/\s+/g, ' ').trim();
    if (freeText) {
      filters.push(
        new SearchFilter.ContainsSubstring(
          ItemSchema.Subject,
          freeText,
          ContainmentMode.Substring,
          ComparisonMode.IgnoreCase,
        ),
      );
    }

    if (filters.length === 0) return null;
    if (filters.length === 1) return filters[0];

    // Gộp tất cả bằng AND
    const collection = new SearchFilter.SearchFilterCollection(
      LogicalOperator.And,
    );
    filters.forEach((f) => collection.Add(f));
    return collection;
  }

  async search(
    query: string,
    page: number,
    limit: number,
    folder: string = 'inbox',
    mailbox?: string,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
    if (!this.service) throw new Error('EWS service not connected');

    const view = new ItemView(limit, (page - 1) * limit);
    view.OrderBy.Add(ItemSchema.DateTimeReceived, SortDirection.Descending);
    view.PropertySet = LIST_PROPS;

    const resolveFolder =
      folder.toLowerCase() === 'all'
        ? this.toFolderId(WellKnownFolderName.Inbox, mailbox)
        : this.toFolderId(this.resolveFolderName(folder), mailbox);

    try {
      // Ưu tiên SearchFilter nếu query có bất kỳ keyword nào
      const searchFilter = this.buildSearchFilter(query);

      const result = searchFilter
        ? await this.service.FindItems(resolveFolder, searchFilter, view)
        : await this.service.FindItems(resolveFolder, query ?? '', view);

      const items: Partial<MailMessage>[] = result.Items.map((item: any) => ({
        id: this.encodeId(
          folder.toLowerCase() === 'all' ? 'INBOX' : folder.toUpperCase(),
          item.Id?.UniqueId ?? '',
          mailbox,
        ),
        subject: item.Subject ?? '(không có chủ đề)',
        from: this.getFrom(item),
        receivedAt: this.toJsDate(item.DateTimeReceived),
        isRead: item.IsRead ?? false,
        hasAttachments: item.HasAttachments ?? false,
        isStarred: this.isItemStarred(item),
      }));

      return { items, total: result.TotalCount ?? 0 };
    } catch (err) {
      this.logger.error(`Search error: ${err.message}`);
      return { items: [], total: 0 };
    }
  }

  // ─── Move ─────────────────────────────────────────────────────────────────

  async moveMessage(
    messageId: string,
    targetFolder: string,
  ): Promise<{ success: boolean }> {
    if (!this.service) throw new Error('EWS service not connected');

    const { itemId, mailbox } = this.decodeId(messageId);
    await this.service.MoveItems(
      [new ItemId(itemId)],
      this.toFolderId(this.resolveFolderName(targetFolder), mailbox),
    );
    return { success: true };
  }

  async moveMessagesBatch(ids: string[], targetFolder: string): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const decoded = this.decodeId(ids[0]);
    const mailbox = decoded.mailbox;

    await this.service.MoveItems(
      ids.map((id) => new ItemId(this.decodeId(id).itemId)),
      this.toFolderId(this.resolveFolderName(targetFolder), mailbox),
    );
  }

  async moveAllMessages(
    sourceFolder: string,
    targetFolder: string,
    mailbox?: string,
  ): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const source = this.toFolderId(
      this.resolveFolderName(sourceFolder),
      mailbox,
    );
    const target = this.resolveFolderName(targetFolder);
    let more = true;

    while (more) {
      // Luôn query offset=0 — sau khi move items đã bị remove khỏi source
      const view = new ItemView(200, 0);
      view.PropertySet = new PropertySet(BasePropertySet.IdOnly);

      const result = await this.service.FindItems(source, view);
      if (!result.Items.length) break;

      await this.service.MoveItems(
        result.Items.map((item) => new ItemId(item.Id.UniqueId)),
        this.toFolderId(target, mailbox),
      );
    }
  }

  async markAsJunk(
    ids: string[],
    isJunk: boolean,
    moveItem: boolean = true,
  ): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    // MarkAsJunk operation adds/removes senders from Blocked Senders List
    // and optionally moves the items to Junk Email folder.
    await this.service.MarkAsJunk(
      ids.map((id) => new ItemId(this.decodeId(id).itemId)),
      isJunk,
      moveItem,
    );
  }

  // ─── Mark read/unread ─────────────────────────────────────────────────────

  async markMessages(ids: string[], isRead: boolean): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const props = new PropertySet(
      BasePropertySet.IdOnly,
      EmailMessageSchema.IsRead,
    );
    for (const id of ids) {
      const { itemId } = this.decodeId(id);
      const msg = await EmailMessage.Bind(
        this.service,
        new ItemId(itemId),
        props,
      );
      if ((msg as any).IsRead !== isRead) {
        (msg as any).IsRead = isRead;
        await msg.Update(ConflictResolutionMode.AlwaysOverwrite);
      }
    }
  }

  async markAllMessages(
    folder: string,
    isRead: boolean,
    mailbox?: string,
  ): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const resolved = this.toFolderId(this.resolveFolderName(folder), mailbox);
    const props = new PropertySet(
      BasePropertySet.IdOnly,
      EmailMessageSchema.IsRead,
    );
    let offset = 0;
    let more = true;

    while (more) {
      const view = new ItemView(200, offset);
      view.PropertySet = props;

      const result = await this.service.FindItems(resolved, view);
      if (!result.Items.length) break;

      for (const item of result.Items) {
        const msg = await EmailMessage.Bind(
          this.service,
          new ItemId(item.Id.UniqueId),
          props,
        );
        if ((msg as any).IsRead !== isRead) {
          (msg as any).IsRead = isRead;
          await msg.Update(ConflictResolutionMode.AlwaysOverwrite);
        }
      }

      offset += result.Items.length;
      more = result.MoreAvailable ?? false;
    }
  }

  // ─── Star / Unstar ────────────────────────────────────────────────────────

  /**
   * Bind message với fallback khi FLAG_ONLY_PROPS bị Exchange từ chối.
   * Exchange 2019 on-prem đôi khi không chấp nhận kết hợp extended property
   * phức tạp (IdOnly + Categories + Flag properties) trong một yêu cầu.
   * Fallback xuống bộ property tối giản: chỉ IdOnly + PR_FLAG_STATUS.
   */
  private async bindForFlag(itemId: string): Promise<EmailMessage> {
    try {
      // Thử Bind với FLAG_ONLY_PROPS đầy đủ trước
      return await EmailMessage.Bind(
        this.service!,
        new ItemId(itemId),
        FLAG_ONLY_PROPS,
      );
    } catch (err) {
      const errMsg = String(err?.message ?? '');
      if (
        !errMsg.includes('extended property attribute combination is invalid')
      ) {
        throw err;
      }
      // Fallback: chỉ dùng IdOnly + PR_FLAG_STATUS tối giản nhất
      this.logger.warn(
        `FLAG_ONLY_PROPS bị từ chối, fallback tối giản: ${errMsg}`,
      );
      const minimalProps = new PropertySet(
        BasePropertySet.IdOnly,
        PR_FLAG_STATUS,
      );
      return await EmailMessage.Bind(
        this.service!,
        new ItemId(itemId),
        minimalProps,
      );
    }
  }

  async markMessagesStar(ids: string[], starred: boolean): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    for (const id of ids) {
      const { itemId } = this.decodeId(id);

      // Thử bind với FLAG_ONLY_PROPS đầy đủ trước
      let message: EmailMessage;
      let useMinimal = false;

      try {
        message = await EmailMessage.Bind(
          this.service,
          new ItemId(itemId),
          FLAG_ONLY_PROPS,
        );
      } catch (bindErr) {
        const bindMsg = String(bindErr?.message ?? '');
        if (
          !bindMsg.includes(
            'extended property attribute combination is invalid',
          )
        ) {
          throw bindErr;
        }
        // Fallback: chỉ bind IdOnly + PR_FLAG_STATUS
        this.logger.warn(
          `FLAG_ONLY_PROPS bị từ chối, fallback tối giản: ${bindMsg}`,
        );
        const minimalProps = new PropertySet(
          BasePropertySet.IdOnly,
          PR_FLAG_STATUS,
        );
        message = await EmailMessage.Bind(
          this.service,
          new ItemId(itemId),
          minimalProps,
        );
        useMinimal = true;
      }

      // Thử update đầy đủ trước, nếu lỗi thì fallback sang chế độ tối giản
      try {
        await this.setFlag(message, starred, useMinimal);
      } catch (updateErr) {
        const updateMsg = String(updateErr?.message ?? '');
        if (
          !useMinimal &&
          updateMsg.includes(
            'extended property attribute combination is invalid',
          )
        ) {
          this.logger.warn(
            `setFlag đầy đủ bị từ chối, thử lại với chế độ tối giản`,
          );
          // Rebind với property tối giản rồi update lại
          const minimalProps2 = new PropertySet(
            BasePropertySet.IdOnly,
            PR_FLAG_STATUS,
          );
          const msg2 = await EmailMessage.Bind(
            this.service,
            new ItemId(itemId),
            minimalProps2,
          );
          await this.setFlag(msg2, starred, true);
        } else {
          throw updateErr;
        }
      }
    }
  }

  async markAllMessagesStar(
    folder: string,
    starred: boolean,
    mailbox?: string,
  ): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const resolved = this.toFolderId(this.resolveFolderName(folder), mailbox);
    let offset = 0;
    let more = true;

    while (more) {
      // Dùng IdOnly cho FindItem để tránh lỗi extended property trên danh sách
      const view = new ItemView(200, offset);
      view.PropertySet = new PropertySet(BasePropertySet.IdOnly);

      const result = await this.service.FindItems(resolved, view);
      if (!result.Items.length) break;

      for (const item of result.Items) {
        const message = await this.bindForFlag(item.Id.UniqueId);
        await this.setFlag(message, starred);
      }

      offset += result.Items.length;
      more = result.MoreAvailable ?? false;
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async permanentlyDeleteMessages(ids: string[]): Promise<number> {
    if (!this.service) throw new Error('EWS service not connected');

    const response: ServiceResponseCollection<any> =
      await this.service.DeleteItems(
        ids.map((id) => new ItemId(this.decodeId(id).itemId)),
        DeleteMode.HardDelete,
        SendCancellationsMode.SendToNone,
        AffectedTaskOccurrence.AllOccurrences,
      );
    return response.Responses.filter(
      (r) => r.ErrorCode === ServiceError.NoError,
    ).length;
  }

  async permanentlyDeleteAllMessages(
    folder: string,
    mailbox?: string,
  ): Promise<number> {
    if (!this.service) throw new Error('EWS service not connected');

    const resolved = this.toFolderId(this.resolveFolderName(folder), mailbox);
    let offset = 0;
    let more = true;
    let deleted = 0;

    while (true) {
      // Khi xóa vĩnh viễn, chúng ta không dùng offset vì list items sẽ co lại sau mỗi lần xóa
      const view = new ItemView(200, 0);
      view.PropertySet = new PropertySet(BasePropertySet.IdOnly);

      const result = await this.service.FindItems(resolved, view);
      if (!result.Items.length) break;

      const response: ServiceResponseCollection<any> =
        await this.service.DeleteItems(
          result.Items.map((item) => new ItemId(item.Id.UniqueId)),
          DeleteMode.HardDelete,
          SendCancellationsMode.SendToNone,
          AffectedTaskOccurrence.AllOccurrences,
        );

      const count = response.Responses.filter(
        (r) => r.ErrorCode === ServiceError.NoError,
      ).length;
      deleted += count;

      if (!result.MoreAvailable && count === result.Items.length) break;
      if (count === 0) break; // Tránh vòng lặp vô tận nếu xóa lỗi
    }

    return deleted;
  }

  // ─── Contacts ───────────────────────────────────────────────────────────────

  /**
   * Tìm contact theo email.
   *
   * Dùng ContactSchema.EmailAddress1/2/3 (IndexedPropertyDefinition) trong filter
   * — đây là cách duy nhất được EWS chấp nhận trong FindItem request.
   * ContactSchema.EmailAddresses (complex dict) không được phép trong FindItem.
   *
   * Sau khi tìm thấy, thực hiện Contact.Bind để load đầy đủ data (bao gồm
   * EmailAddresses dictionary và PhoneNumbers dictionary).
   */
  private async findContactByEmail(email: string): Promise<Contact | null> {
    if (!this.service) throw new Error('EWS service not connected');

    const normalized = this.normalizeEmail(email);
    if (!normalized) return null;

    // Dùng IndexedPropertyDefinition — được EWS hỗ trợ trong FindItem
    const filter = new SearchFilter.SearchFilterCollection(LogicalOperator.Or, [
      new SearchFilter.IsEqualTo(ContactSchema.EmailAddress1, normalized),
      new SearchFilter.IsEqualTo(ContactSchema.EmailAddress2, normalized),
      new SearchFilter.IsEqualTo(ContactSchema.EmailAddress3, normalized),
    ]);

    // Chỉ cần Id để sau đó Bind — không cần load email lại ở đây
    const view = new ItemView(2, 0);
    view.PropertySet = new PropertySet(BasePropertySet.IdOnly);

    const result = await this.service.FindItems(
      WellKnownFolderName.Contacts,
      filter,
      view,
    );
    if (!result.Items?.length) return null;

    const item = result.Items[0];
    // Bind để load đầy đủ properties bao gồm EmailAddresses và PhoneNumbers
    return Contact.Bind(
      this.service,
      new ItemId(item.Id.UniqueId),
      CONTACT_DETAIL_PROPS,
    );
  }

  async createContact(payload: {
    displayName: string;
    email: string;
    givenName?: string;
    surname?: string;
    company?: string;
    jobTitle?: string;
    phone?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  }): Promise<ExchangeContact> {
    if (!this.service) throw new Error('EWS service not connected');

    const existing = await this.findContactByEmail(payload.email);
    if (existing) {
      throw new BadRequestException('Contact email already exists');
    }

    const contact = new Contact(this.service);
    contact.DisplayName = payload.displayName;
    if (payload.givenName) contact.GivenName = payload.givenName;
    if (payload.surname) contact.Surname = payload.surname;
    if (payload.company) contact.CompanyName = payload.company;
    if (payload.jobTitle) contact.JobTitle = payload.jobTitle;

    const emailAddr = new EmailAddress(payload.email);
    emailAddr.RoutingType = 'SMTP';
    contact.EmailAddresses._setItem(EmailAddressKey.EmailAddress1, emailAddr);

    if (payload.phone) {
      contact.PhoneNumbers._setItem(PhoneNumberKey.MobilePhone, payload.phone);
    }
    if (payload.address) {
      const addr = new PhysicalAddressEntry();
      addr.Street = payload.address.street ?? '';
      addr.City = payload.address.city ?? '';
      addr.State = payload.address.state ?? '';
      addr.PostalCode = payload.address.postalCode ?? '';
      addr.CountryOrRegion = payload.address.country ?? '';
      contact.PhysicalAddresses._setItem(PhysicalAddressKey.Business, addr);
    }

    await contact.Save(WellKnownFolderName.Contacts);

    const uniqueId = contact.Id?.UniqueId;
    if (!uniqueId) {
      throw new Error('Contact saved but UniqueId not returned from Exchange');
    }

    return {
      id: this.encodeContactId(uniqueId),
      displayName: payload.displayName,
      email: payload.email,
      givenName: payload.givenName ?? '',
      surname: payload.surname ?? '',
      company: payload.company ?? '',
      jobTitle: payload.jobTitle ?? '',
      phone: payload.phone ?? '',
      address: payload.address ?? undefined,
    };
  }

  async updateContact(
    id: string,
    payload: {
      displayName?: string;
      email?: string;
      givenName?: string;
      surname?: string;
      company?: string;
      jobTitle?: string;
      phone?: string;
      address?: {
        street?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
    },
  ): Promise<ExchangeContact> {
    if (!this.service) throw new Error('EWS service not connected');

    const itemId = this.decodeContactId(id);
    const contact = await Contact.Bind(
      this.service,
      new ItemId(itemId),
      CONTACT_DETAIL_PROPS,
    );

    if (
      payload.email &&
      this.normalizeEmail(payload.email) !==
      this.normalizeEmail(this.getContactPrimaryEmail(contact))
    ) {
      const existing = await this.findContactByEmail(payload.email);
      if (existing && existing.Id?.UniqueId !== contact.Id?.UniqueId) {
        throw new BadRequestException('Contact email already exists');
      }
      const emailAddr = new EmailAddress(payload.email);
      emailAddr.RoutingType = 'SMTP';
      contact.EmailAddresses._setItem(EmailAddressKey.EmailAddress1, emailAddr);
    }

    if (payload.displayName !== undefined)
      contact.DisplayName = payload.displayName;
    if (payload.givenName !== undefined) contact.GivenName = payload.givenName;
    if (payload.surname !== undefined) contact.Surname = payload.surname;
    if (payload.company !== undefined) contact.CompanyName = payload.company;
    if (payload.jobTitle !== undefined) contact.JobTitle = payload.jobTitle;
    if (payload.phone !== undefined) {
      if (payload.phone) {
        contact.PhoneNumbers._setItem(
          PhoneNumberKey.MobilePhone,
          payload.phone,
        );
      } else {
        contact.PhoneNumbers._setItem(PhoneNumberKey.MobilePhone, '');
      }
    }
    if (payload.address !== undefined) {
      const addr = new PhysicalAddressEntry();
      addr.Street = payload.address?.street ?? '';
      addr.City = payload.address?.city ?? '';
      addr.State = payload.address?.state ?? '';
      addr.PostalCode = payload.address?.postalCode ?? '';
      addr.CountryOrRegion = payload.address?.country ?? '';
      contact.PhysicalAddresses._setItem(PhysicalAddressKey.Business, addr);
    }

    await contact.Update(ConflictResolutionMode.AlwaysOverwrite);

    return {
      id: this.encodeContactId(contact.Id?.UniqueId ?? ''),
      displayName: contact.DisplayName ?? '',
      email: this.getContactPrimaryEmail(contact),
      givenName: contact.GivenName ?? '',
      surname: contact.Surname ?? '',
      company: contact.CompanyName ?? '',
      jobTitle: contact.JobTitle ?? '',
      phone: this.getContactPrimaryPhone(contact),
      address: this.getContactPrimaryAddress(contact),
    };
  }

  async deleteContact(id: string): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');
    const itemId = this.decodeContactId(id);
    const contact = await Contact.Bind(
      this.service,
      new ItemId(itemId),
      CONTACT_DETAIL_PROPS,
    );
    await contact.Delete(DeleteMode.MoveToDeletedItems);
  }

  async getContactByEmail(email: string): Promise<ExchangeContact | null> {
    if (!this.service) throw new Error('EWS service not connected');
    const contact = await this.findContactByEmail(email);
    if (!contact) return null;

    return {
      id: this.encodeContactId(contact.Id?.UniqueId ?? ''),
      displayName: contact.DisplayName ?? '',
      email: this.getContactPrimaryEmail(contact),
      givenName: contact.GivenName ?? '',
      surname: contact.Surname ?? '',
      company: contact.CompanyName ?? '',
      jobTitle: contact.JobTitle ?? '',
      phone: this.getContactPrimaryPhone(contact),
      address: this.getContactPrimaryAddress(contact),
    };
  }

  async getContactById(id: string): Promise<ExchangeContact | null> {
    if (!this.service) throw new Error('EWS service not connected');
    const itemId = this.decodeContactId(id);

    try {
      const contact = await Contact.Bind(
        this.service,
        new ItemId(itemId),
        CONTACT_DETAIL_PROPS,
      );

      return {
        id: this.encodeContactId(contact.Id?.UniqueId ?? ''),
        displayName: contact.DisplayName ?? '',
        email: this.getContactPrimaryEmail(contact),
        givenName: contact.GivenName ?? '',
        surname: contact.Surname ?? '',
        company: contact.CompanyName ?? '',
        jobTitle: contact.JobTitle ?? '',
        phone: this.getContactPrimaryPhone(contact),
        address: this.getContactPrimaryAddress(contact),
      };
    } catch (error) {
      this.logger.warn(`Contact not found for id: ${id}`);
      return null;
    }
  }

  async searchContacts(
    keyword: string,
    page: number,
    limit: number,
  ): Promise<ExchangeSearchResult<ExchangeContact>> {
    if (!this.service) throw new Error('EWS service not connected');

    const trimmed = (keyword || '').trim();
    const offset = (page - 1) * limit;

    // CONTACT_LIST_PROPS chỉ dùng IndexedPropertyDefinitions — hợp lệ trong FindItem
    const view = new ItemView(limit, offset);
    view.PropertySet = CONTACT_LIST_PROPS;

    const mapContact = async (item: any): Promise<ExchangeContact> => {
      try {
        const contact = await Contact.Bind(
          this.service!,
          new ItemId(item.Id!.UniqueId),
          CONTACT_DETAIL_PROPS,
        );
        return {
          id: this.encodeContactId(contact.Id?.UniqueId ?? ''),
          displayName: contact.DisplayName ?? '',
          email: this.getContactPrimaryEmail(contact),
          givenName: contact.GivenName ?? '',
          surname: contact.Surname ?? '',
          company: contact.CompanyName ?? '',
          jobTitle: contact.JobTitle ?? '',
          phone: this.getContactPrimaryPhone(contact),
          address: this.getContactPrimaryAddress(contact),
        };
      } catch {
        const contact = item as Contact;
        return {
          id: this.encodeContactId(contact.Id?.UniqueId ?? ''),
          displayName: contact.DisplayName ?? '',
          email: this.getContactPrimaryEmail(contact),
          givenName: contact.GivenName ?? '',
          surname: contact.Surname ?? '',
          company: contact.CompanyName ?? '',
          jobTitle: contact.JobTitle ?? '',
          phone: this.getContactPrimaryPhone(contact),
          address: this.getContactPrimaryAddress(contact),
        };
      }
    };

    if (!trimmed) {
      // Không filter — lấy toàn bộ IPM.Contact
      const filter = new SearchFilter.IsEqualTo(ItemSchema.ItemClass, 'IPM.Contact');
      const result = await this.service.FindItems(
        WellKnownFolderName.Contacts,
        filter,
        view,
      );
      const items = await Promise.all(result.Items.map(mapContact));
      return { items, total: result.TotalCount ?? items.length };
    }

    // Filter theo DisplayName hoặc email — dùng IndexedPropertyDefinition cho email
    // ContactSchema.EmailAddresses (complex) KHÔNG được phép trong FindItem filter.
    // Theo yêu cầu: Chạy 2 luồng tìm kiếm song song cho DisplayName và EmailAddress1
    console.log(`[EwsMailProvider] Searching contacts (Parallel): "${trimmed}"`);

    const nameFilter = new SearchFilter.ContainsSubstring(
      ContactSchema.DisplayName, 
      trimmed, 
      ContainmentMode.Substring, 
      ComparisonMode.IgnoreCase
    );

    const emailFilter = new SearchFilter.ContainsSubstring(
      ContactSchema.EmailAddress1, 
      trimmed, 
      ContainmentMode.Substring, 
      ComparisonMode.IgnoreCase
    );

    // Chạy song song 2 luồng tìm kiếm
    const [nameRes, emailRes] = await Promise.all([
      this.service.FindItems(WellKnownFolderName.Contacts, nameFilter, view),
      this.service.FindItems(WellKnownFolderName.Contacts, emailFilter, view)
    ]);

    // Gộp kết quả và loại bỏ trùng lặp theo UniqueId
    const combinedItemsMap = new Map();
    [...nameRes.Items, ...emailRes.Items].forEach(item => {
      combinedItemsMap.set(item.Id.UniqueId, item);
    });

    const finalItems = Array.from(combinedItemsMap.values());
    console.log(`[EwsMailProvider] Parallel search finished. Found ${finalItems.length} unique results.`);

    // Map dữ liệu và trả về (giới hạn theo limit của view hiện tại)
    const items = await Promise.all(finalItems.slice(0, limit).map(mapContact));
    const total = (nameRes.TotalCount || 0) + (emailRes.TotalCount || 0);
    
    return { items, total: Math.max(items.length, total) };
  }

 async getContactsCount(): Promise<number> {
  if (!this.service) throw new Error('EWS service not connected');

  try {
    // Filter chỉ lấy IPM.Contact (loại trừ Distribution Lists và các loại khác)
    const filter = new SearchFilter.IsEqualTo(
      ItemSchema.ItemClass, 
      'IPM.Contact'
    );

    // Dùng FindItems với limit 1 để chỉ lấy TotalCount (hiệu quả nhất)
    const view = new ItemView(25, 0);
    view.PropertySet = new PropertySet(BasePropertySet.IdOnly);

    const result = await this.service.FindItems(
      WellKnownFolderName.Contacts,
      filter,
      view,
    );

    const totalCount = result.TotalCount || 0;
    console.log(`[EwsMailProvider] Total IPM.Contact count: ${totalCount}`);
    
    return Math.max(0, totalCount);
  } catch (error) {
    console.error('[EwsMailProvider] Error getting contacts count:', error);
    
    // Fallback: Nếu lỗi, dùng Folder.Bind (ít chính xác hơn)
    try {
      const folder = await Folder.Bind(this.service, WellKnownFolderName.Contacts);
      console.warn(`[EwsMailProvider] Fallback to folder.TotalCount: ${folder.TotalCount}`);
      return Math.max(0, folder.TotalCount || 0);
    } catch {
      return 0;
    }
  }
}

  async listNotes(
    page: number,
    limit: number,
  ): Promise<ExchangeSearchResult<ExchangeNote>> {
    if (!this.service) throw new Error('EWS service not connected');

    const view = new ItemView(limit, (page - 1) * limit);
    view.PropertySet = NOTE_LIST_PROPS;

    const filter = new SearchFilter.IsEqualTo(
      ItemSchema.ItemClass,
      'IPM.StickyNote',
    );
    const result = await this.service.FindItems(
      WellKnownFolderName.Notes,
      filter,
      view,
    );

    const items = result.Items.map((item: any) => ({
      id: this.encodeNoteId(item.Id?.UniqueId ?? ''),
      subject: item.Subject ?? '',
      content: item.Body?.Text ?? '',
      createdAt: this.toJsDate(item.DateTimeCreated),
      updatedAt: this.toJsDate(item.LastModifiedTime),
    }));

    return { items, total: result.TotalCount ?? items.length };
  }

  async createNote(payload: {
    subject?: string;
    content: string;
  }): Promise<ExchangeNote> {
    if (!this.service) throw new Error('EWS service not connected');

    const note = new (Item as any)(this.service) as Item;
    note.Subject = payload.subject ?? '';
    note.Body = new MessageBody(BodyType.Text, payload.content);
    note.ItemClass = 'IPM.StickyNote';

    await note.Save(WellKnownFolderName.Notes);

    return {
      id: this.encodeNoteId(note.Id?.UniqueId ?? ''),
      subject: note.Subject ?? '',
      content: payload.content,
      createdAt: this.toJsDate(note.DateTimeCreated),
      updatedAt: this.toJsDate(note.LastModifiedTime),
    };
  }

  async updateNote(
    id: string,
    payload: { subject?: string; content?: string },
  ): Promise<ExchangeNote> {
    if (!this.service) throw new Error('EWS service not connected');

    const itemId = this.decodeNoteId(id);
    const note = await Item.Bind(
      this.service,
      new ItemId(itemId),
      NOTE_LIST_PROPS,
    );

    if (payload.subject !== undefined) note.Subject = payload.subject;
    if (payload.content !== undefined) {
      note.Body = new MessageBody(BodyType.Text, payload.content);
    }

    await note.Update(ConflictResolutionMode.AlwaysOverwrite);

    return {
      id: this.encodeNoteId(note.Id?.UniqueId ?? ''),
      subject: note.Subject ?? '',
      content: note.Body?.Text ?? '',
      createdAt: this.toJsDate(note.DateTimeCreated),
      updatedAt: this.toJsDate(note.LastModifiedTime),
    };
  }

  async deleteNote(id: string): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');
    const itemId = this.decodeNoteId(id);
    const note = await Item.Bind(
      this.service,
      new ItemId(itemId),
      NOTE_LIST_PROPS,
    );
    await note.Delete(DeleteMode.MoveToDeletedItems);
  }

  // ─── CALENDAR & REMINDERS ────────────────────────────────────────────────────────

  async createEvent(payload: {
    subject: string;
    body: string;
    start: string; // ISO String
    end: string; // ISO String
    location?: string;
    isAllDayEvent?: boolean;
    isReminderSet?: boolean;
    reminderMinutesBeforeStart?: number;
  }): Promise<string> {
    if (!this.service) throw new Error('EWS service not connected');

    const appointment = new Appointment(this.service);
    appointment.Subject = payload.subject;
    appointment.Body = new MessageBody(BodyType.HTML, payload.body);
    appointment.Start = new DateTime(payload.start);
    appointment.End = new DateTime(payload.end);

    if (payload.location) appointment.Location = payload.location;
    if (payload.isAllDayEvent !== undefined)
      appointment.IsAllDayEvent = payload.isAllDayEvent;

    if (payload.isReminderSet) {
      appointment.IsReminderSet = true;
      appointment.ReminderMinutesBeforeStart =
        payload.reminderMinutesBeforeStart ?? 15;
    } else {
      appointment.IsReminderSet = false;
    }

    // Save to Calendar. SendToNone nếu không có attendees
    await appointment.Save(SendInvitationsMode.SendToNone);

    return appointment.Id?.UniqueId ?? '';
  }

  async getEvents(startDate: string, endDate: string): Promise<any[]> {
    if (!this.service) throw new Error('EWS service not connected');

    const folder = await CalendarFolder.Bind(
      this.service,
      WellKnownFolderName.Calendar,
    );
    const view = new CalendarView(
      new DateTime(startDate),
      new DateTime(endDate),
    );

    const results = await folder.FindAppointments(view);

    // FindAppointments chỉ trả về First-Class Properties, Body KHÔNG được load tự động.
    // Cần gọi LoadPropertiesForItems để load thêm Body trước khi truy cập.
    if (results.Items.length > 0) {
      const propertySet = new PropertySet(
        BasePropertySet.FirstClassProperties,
        ItemSchema.Body,
      );
      await this.service.LoadPropertiesForItems(results.Items, propertySet);
    }

    return results.Items.map((apt: Appointment) => ({
      id: apt.Id?.UniqueId ?? '',
      subject: apt.Subject ?? '',
      start: apt.Start?.ToISOString() ?? '',
      end: apt.End?.ToISOString() ?? '',
      location: apt.Location ?? '',
      isAllDayEvent: apt.IsAllDayEvent ?? false,
      isReminderSet: apt.IsReminderSet ?? false,
      reminderMinutesBeforeStart: apt.ReminderMinutesBeforeStart ?? 0,
      // Lấy text của Body, fallback về chuỗi rỗng nếu vẫn chưa được load
      bodyPreview: (() => {
        try {
          return apt.Body?.Text ?? '';
        } catch {
          return '';
        }
      })(),
    }));
  }

  async getEventDetails(id: string): Promise<any> {
    if (!this.service) throw new Error('EWS service not connected');

    const appointment = await Appointment.Bind(this.service, new ItemId(id));
    return {
      id: appointment.Id?.UniqueId ?? '',
      subject: appointment.Subject ?? '',
      body: appointment.Body?.Text ?? '',
      start: appointment.Start?.ToISOString() ?? '',
      end: appointment.End?.ToISOString() ?? '',
      location: appointment.Location ?? '',
      isAllDayEvent: appointment.IsAllDayEvent ?? false,
      isReminderSet: appointment.IsReminderSet ?? false,
      reminderMinutesBeforeStart: appointment.ReminderMinutesBeforeStart ?? 0,
    };
  }

  async updateEvent(id: string, payload: any): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const appointment = await Appointment.Bind(this.service, new ItemId(id));

    if (payload.subject !== undefined) appointment.Subject = payload.subject;
    if (payload.body !== undefined)
      appointment.Body = new MessageBody(BodyType.HTML, payload.body);
    if (payload.start) appointment.Start = new DateTime(payload.start);
    if (payload.end) appointment.End = new DateTime(payload.end);
    if (payload.location !== undefined) appointment.Location = payload.location;
    if (payload.isAllDayEvent !== undefined)
      appointment.IsAllDayEvent = payload.isAllDayEvent;

    if (payload.isReminderSet !== undefined) {
      appointment.IsReminderSet = payload.isReminderSet;
      if (
        payload.isReminderSet &&
        payload.reminderMinutesBeforeStart !== undefined
      ) {
        appointment.ReminderMinutesBeforeStart =
          payload.reminderMinutesBeforeStart;
      }
    }

    await appointment.Update(
      ConflictResolutionMode.AlwaysOverwrite,
      SendInvitationsOrCancellationsMode.SendToNone,
    );
  }

  async deleteEvent(id: string): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const appointment = await Appointment.Bind(this.service, new ItemId(id));
    await appointment.Delete(
      DeleteMode.MoveToDeletedItems,
      SendCancellationsMode.SendToNone,
    );
  }

  async getActiveReminders(): Promise<any[]> {
    if (!this.service) throw new Error('EWS service not connected');

    // Tìm lịch trình trong 24h qua và 1 độ trễ nhỏ để không sót nhắc nhở
    const start = DateTime.Now;
    const end = start.AddDays(1);

    const folder = await CalendarFolder.Bind(
      this.service,
      WellKnownFolderName.Calendar,
    );
    const view = new CalendarView(start, end);

    const results = await folder.FindAppointments(view);

    const now = new Date();

    const activeReminders = results.Items.filter((apt: Appointment) => {
      if (!apt.IsReminderSet) return false;

      const aptStart = new Date(apt.Start.ToISOString());
      const reminderMinutes = apt.ReminderMinutesBeforeStart || 15;
      const reminderTime = new Date(
        aptStart.getTime() - reminderMinutes * 60000,
      );
      const aptEnd = new Date(apt.End.ToISOString());

      return now >= reminderTime && now <= aptEnd;
    });

    return activeReminders.map((apt: Appointment) => ({
      id: apt.Id?.UniqueId ?? '',
      subject: apt.Subject ?? '',
      start: apt.Start?.ToISOString() ?? '',
      end: apt.End?.ToISOString() ?? '',
      reminderMinutesBeforeStart: apt.ReminderMinutesBeforeStart ?? 0,
    }));
  }

  async dismissReminder(id: string): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const appointment = await Appointment.Bind(this.service, new ItemId(id));
    appointment.IsReminderSet = false;
    await appointment.Update(
      ConflictResolutionMode.AlwaysOverwrite,
      SendInvitationsOrCancellationsMode.SendToNone,
    );
  }
}
