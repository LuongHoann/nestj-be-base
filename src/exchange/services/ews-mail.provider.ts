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
  OAuthCredentials,
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
  MessageBody,
  BodyType,
  FolderSchema,
  EmailMessageSchema,
  ItemSchema,
  ItemTraversal,
  ItemId,
  ImpersonatedUserId,
  ConnectingIdType,
  DeleteMode,
  SendInvitationsMode,
  SendCancellationsMode,
  AffectedTaskOccurrence,
  ConflictResolutionMode,
  ServiceResponseCollection,
  ServiceError,
} from 'ews-javascript-api';
import { XhrApi } from '@ewsjs/xhr';
import { DragonflyService } from '../../common/cache/dragonfly.service';
import { ExchangeAuthService } from './exchange-auth.service';
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

@Injectable({ scope: Scope.REQUEST })
export class EwsMailProvider implements IMailProvider {
  private readonly logger = new Logger(EwsMailProvider.name);
  private service: ExchangeService | null = null;
  private email: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly cache: DragonflyService,
    private readonly authService: ExchangeAuthService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private get ewsConfig() {
    return {
      url: this.configService.get<string>('EWS_URL') || '',
      tokenUrl: this.configService.get<string>('EWS_TOKEN_URL') || '',
      clientId: this.configService.get<string>('EWS_CLIENT_ID') || '',
      clientSecret: this.configService.get<string>('EWS_CLIENT_SECRET') || '',
      scope: this.configService.get<string>('EWS_SCOPE') || '',
      resource: this.configService.get<string>('EWS_RESOURCE') || '',
      version: this.configService.get<string>('EWS_VERSION') || 'Exchange2016',
      impersonate: this.configService.get<string>('EWS_IMPERSONATE') === 'true',
      tlsRejectUnauthorized:
        this.configService.get<string>('EWS_TLS_REJECT_UNAUTHORIZED') !== 'false',
    };
  }

  private async getAccessToken(): Promise<string> {
    const ssoEnabled = this.configService.get<string>('EWS_SSO_ENABLED') !== 'false';
    if (!ssoEnabled) {
      throw new UnauthorizedException('SSO is disabled');
    }
    const cacheKey = 'ews:token';
    const cached = await this.cache.get<{
      token: string;
      expiresAt: number;
    }>(cacheKey);

    const now = Date.now();
    if (cached && cached.expiresAt > now + 30_000) {
      return cached.token;
    }

    const cfg = this.ewsConfig;
    if (!cfg.tokenUrl || !cfg.clientId || !cfg.clientSecret) {
      throw new Error('EWS OAuth2 config is missing');
    }

    const body = new URLSearchParams();
    body.set('client_id', cfg.clientId);
    body.set('client_secret', cfg.clientSecret);
    body.set('grant_type', 'client_credentials');

    if (cfg.scope) {
      body.set('scope', cfg.scope);
    } else if (cfg.resource) {
      body.set('resource', cfg.resource);
    }

    const response = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch EWS token: ${text}`);
    }

    const payload = (await response.json()) as {
      access_token: string;
      expires_in?: number;
    };

    const expiresIn = (payload.expires_in || 3600) * 1000;
    const expiresAt = now + expiresIn;
    await this.cache.set(cacheKey, { token: payload.access_token, expiresAt }, 3600);

    return payload.access_token;
  }

  private resolveFolderName(folderId: string): WellKnownFolderName {
    const resolved = resolveFolderId(folderId, folderId);
    const normalized = resolved.toLowerCase();

    if (normalized === 'inbox') return WellKnownFolderName.Inbox;
    if (normalized === 'sent items') return WellKnownFolderName.SentItems;
    if (normalized === 'drafts') return WellKnownFolderName.Drafts;
    if (normalized === 'spam') return WellKnownFolderName.JunkEmail;
    if (normalized === 'trash') return WellKnownFolderName.DeletedItems;

    return WellKnownFolderName.Inbox;
  }

  private encodeId(folder: string, itemId: string): string {
    return Buffer.from(`${folder}:${itemId}`).toString('base64');
  }

  private decodeId(id: string): { folder: string; itemId: string } {
    const decoded = Buffer.from(id, 'base64').toString('utf8');
    const [folder, itemId] = decoded.split(':');
    return { folder, itemId };
  }

  private toJsDate(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value.ToDate === 'function') return value.ToDate();
    if (typeof value.ToISOString === 'function') return new Date(value.ToISOString());
    return new Date(value);
  }

  private getFrom(item: any): { name: string; email: string } {
    const from = item?.From;
    if (!from) {
      return { name: '', email: '' };
    }
    return { name: from.Name || '', email: from.Address || '' };
  }

  private getRecipients(collection: any): { name: string; email: string }[] {
    const items = collection?.items || collection?.Items || [];
    return items.map((addr: any) => ({
      name: addr.Name || '',
      email: addr.Address || '',
    }));
  }

  private toFolderId(folder: WellKnownFolderName): FolderId {
    return new FolderId(folder);
  }

  async connect(): Promise<void> {
    const sessionToken = this.request.cookies?.['exchange_session'];
    if (!sessionToken) {
      throw new UnauthorizedException('No session token provided');
    }

    const creds = await this.authService.getCredentials(sessionToken);
    if (!creds) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    this.email = creds.email;

    const cfg = this.ewsConfig;
    if (!cfg.url) {
      throw new Error('EWS_URL is not configured');
    }
    if (!cfg.tlsRejectUnauthorized) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const service = new ExchangeService(
      ExchangeVersion[cfg.version as keyof typeof ExchangeVersion] ||
        ExchangeVersion.Exchange2016,
    );
    const ssoEnabled = this.configService.get<boolean>('ews.ssoEnabled');
    if (ssoEnabled) {
      const token = await this.getAccessToken();
      service.Credentials = new OAuthCredentials(token);
    } else {
      service.Credentials = new WebCredentials(creds.email, creds.password);
    }
    service.Url = new Uri(cfg.url);

    if (cfg.impersonate && this.email && ssoEnabled) {
      service.ImpersonatedUserId = new ImpersonatedUserId(
        ConnectingIdType.SmtpAddress,
        this.email,
      );
    }

    this.service = service;
  }

  async disconnect(): Promise<void> {
    this.service = null;
  }

  async getFolders(): Promise<MailFolder[]> {
    if (!this.service) throw new Error('EWS service not connected');

    const folders: MailFolder[] = [];

    for (const folder of MAIL_FOLDERS) {
      if (folder.id === 'Starred') {
        folders.push({ id: folder.id, name: folder.name });
        continue;
      }

      const id = this.resolveFolderName(folder.id);
      await Folder.Bind(this.service, id);
      folders.push({ id: folder.id, name: folder.name });
    }

    return folders;
  }

  async getFolderCounts(): Promise<Record<string, { total: number; unread: number }>> {
    if (!this.service) throw new Error('EWS service not connected');

    const counts: Record<string, { total: number; unread: number }> = {};

    for (const folder of MAIL_FOLDERS) {
      if (folder.id === 'Starred') {
        counts[folder.id] = await this.getStarredCounts();
        continue;
      }

      const id = this.resolveFolderName(folder.id);
      const bound = await Folder.Bind(this.service, id, new PropertySet(
        BasePropertySet.IdOnly,
        FolderSchema.TotalCount,
        FolderSchema.UnreadCount,
      ));

      counts[folder.id] = {
        total: bound.TotalCount || 0,
        unread: bound.UnreadCount || 0,
      };
    }

    return counts;
  }

  private async getStarredCounts(): Promise<{ total: number; unread: number }> {
    if (!this.service) throw new Error('EWS service not connected');

    const view = new ItemView(1, 0);
    view.Traversal = ItemTraversal.Shallow;
    const flagProp =
      (EmailMessageSchema as any).FlagStatus ||
      (EmailMessageSchema as any).Flag ||
      (ItemSchema as any).FlagStatus;

    if (!flagProp) {
      return { total: 0, unread: 0 };
    }

    const filter = new SearchFilter.IsEqualTo(flagProp, 2);

    const result = await this.service.FindItems(
      WellKnownFolderName.Inbox,
      filter,
      view,
    );

    const total = result.TotalCount || 0;
    if (!total) return { total: 0, unread: 0 };

    const unreadFilter = new SearchFilter.SearchFilterCollection(
      LogicalOperator.And,
      [
        filter,
        new SearchFilter.IsEqualTo(EmailMessageSchema.IsRead, false),
      ],
    );

    const unreadResult = await this.service.FindItems(
      WellKnownFolderName.Inbox,
      unreadFilter,
      view,
    );

    return {
      total,
      unread: unreadResult.TotalCount || 0,
    };
  }

  async getMessages(
    folderId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
    if (!this.service) throw new Error('EWS service not connected');

    const resolvedFolder = this.resolveFolderName(folderId);
    const offset = (page - 1) * limit;
    const view = new ItemView(limit, offset);
    view.OrderBy.Add(ItemSchema.DateTimeReceived, SortDirection.Descending);
    view.PropertySet = new PropertySet(
      BasePropertySet.IdOnly,
      ItemSchema.Subject,
      ItemSchema.DateTimeReceived,
      EmailMessageSchema.From,
      EmailMessageSchema.IsRead,
      ItemSchema.HasAttachments,
      ItemSchema.Preview,
    );

    const result = await this.service.FindItems(resolvedFolder, view);
    const items = result.Items.map((item: any) => ({
      id: this.encodeId(folderId, item.Id!.UniqueId),
      subject: item.Subject || '(No Subject)',
      from: this.getFrom(item),
      receivedAt: this.toJsDate(item.DateTimeReceived),
      isRead: item.IsRead || false,
      hasAttachments: item.HasAttachments || false,
      preview: item.Preview || '',
    }));

    return { items, total: result.TotalCount || 0 };
  }

  async getMessage(id: string): Promise<MailMessage> {
    if (!this.service) throw new Error('EWS service not connected');

    const { folder, itemId } = this.decodeId(id);
    const message = await EmailMessage.Bind(
      this.service,
      new ItemId(itemId),
    );

    if (!(message as any).IsRead) {
      (message as any).IsRead = true;
      await message.Update(ConflictResolutionMode.AlwaysOverwrite);
    }

    return {
      id,
      subject: message.Subject || '(No Subject)',
      from: message.From
        ? { name: message.From.Name || '', email: message.From.Address || '' }
        : { name: '', email: '' },
      to: this.getRecipients(message.ToRecipients),
      cc: this.getRecipients(message.CcRecipients),
      receivedAt: this.toJsDate(message.DateTimeReceived),
      body: message.Body ? message.Body.Text : '',
      isHtml: message.Body?.BodyType === BodyType.HTML,
      hasAttachments: message.HasAttachments || false,
      isRead: true,
      preview: message.Body ? message.Body.Text.substring(0, 100) : '',
    };
  }

  async sendMessage(
    options: SendMailOptions,
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.service) throw new Error('EWS service not connected');

    const message = new EmailMessage(this.service);
    message.Subject = options.subject || '';
    message.Body = new MessageBody(
      options.html ? BodyType.HTML : BodyType.Text,
      options.html || options.text || '',
    );

    for (const recipient of options.to || []) {
      message.ToRecipients.Add(recipient);
    }
    for (const recipient of options.cc || []) {
      message.CcRecipients.Add(recipient);
    }
    for (const recipient of options.bcc || []) {
      message.BccRecipients.Add(recipient);
    }
    for (const recipient of options.replyTo || []) {
      message.ReplyTo.Add(recipient);
    }

    if (options.attachments && options.attachments.length > 0) {
      for (const attachment of options.attachments) {
        const file = message.Attachments.AddFileAttachment(
          attachment.filename,
          attachment.content,
        );
        if (attachment.contentType) {
          file.ContentType = attachment.contentType;
        }
      }
    }

    await message.SendAndSaveCopy();

    return {
      success: true,
      messageId: message.Id?.UniqueId,
    };
  }

  async search(
    query: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
    if (!this.service) throw new Error('EWS service not connected');

    const offset = (page - 1) * limit;
    const view = new ItemView(limit, offset);
    view.OrderBy.Add(ItemSchema.DateTimeReceived, SortDirection.Descending);
    view.PropertySet = new PropertySet(
      BasePropertySet.IdOnly,
      ItemSchema.Subject,
      ItemSchema.DateTimeReceived,
      EmailMessageSchema.From,
      EmailMessageSchema.IsRead,
      ItemSchema.HasAttachments,
    );

    const filter = new SearchFilter.SearchFilterCollection(LogicalOperator.Or, [
      new SearchFilter.ContainsSubstring(ItemSchema.Subject, query),
      new SearchFilter.ContainsSubstring(ItemSchema.Body, query),
    ]);

    const result = await this.service.FindItems(
      WellKnownFolderName.Inbox,
      filter,
      view,
    );

    const items = result.Items.map((item: any) => ({
      id: this.encodeId('INBOX', item.Id!.UniqueId),
      subject: item.Subject || '(No Subject)',
      from: this.getFrom(item),
      receivedAt: this.toJsDate(item.DateTimeReceived),
      isRead: item.IsRead || false,
      hasAttachments: item.HasAttachments || false,
    }));

    return { items, total: result.TotalCount || 0 };
  }

  async moveMessage(
    messageId: string,
    targetFolder: string,
  ): Promise<{ success: boolean }> {
    if (!this.service) throw new Error('EWS service not connected');

    const { itemId } = this.decodeId(messageId);
    const target = this.resolveFolderName(targetFolder);
    await this.service.MoveItems(
      [new ItemId(itemId)],
      this.toFolderId(target),
    );
    return { success: true };
  }

  async markMessages(ids: string[], isRead: boolean): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    for (const id of ids) {
      const { itemId } = this.decodeId(id);
      const message = await EmailMessage.Bind(this.service, new ItemId(itemId));
      (message as any).IsRead = isRead;
      await message.Update(ConflictResolutionMode.AlwaysOverwrite);
    }
  }

  async markAllMessages(folder: string, isRead: boolean): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');

    const resolved = this.resolveFolderName(folder);
    const view = new ItemView(200, 0);
    view.PropertySet = new PropertySet(BasePropertySet.IdOnly);

    let offset = 0;
    let more = true;

    while (more) {
      view.Offset = offset;
      const result = await this.service.FindItems(resolved, view);
      if (!result.Items.length) break;

      for (const item of result.Items) {
        const message = await EmailMessage.Bind(
          this.service,
          new ItemId(item.Id!.UniqueId),
        );
        (message as any).IsRead = isRead;
        await message.Update(ConflictResolutionMode.AlwaysOverwrite);
      }

      offset += result.Items.length;
      more = result.MoreAvailable || false;
    }
  }

  async moveMessagesBatch(ids: string[], targetFolder: string): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');
    const target = this.resolveFolderName(targetFolder);
    const itemIds = ids.map((id) => new ItemId(this.decodeId(id).itemId));
    await this.service.MoveItems(itemIds, this.toFolderId(target));
  }

  async moveAllMessages(
    sourceFolder: string,
    targetFolder: string,
  ): Promise<void> {
    if (!this.service) throw new Error('EWS service not connected');
    const source = this.resolveFolderName(sourceFolder);
    const target = this.resolveFolderName(targetFolder);
    const view = new ItemView(200, 0);
    view.PropertySet = new PropertySet(BasePropertySet.IdOnly);

    let offset = 0;
    let more = true;

    while (more) {
      view.Offset = offset;
      const result = await this.service.FindItems(source, view);
      if (!result.Items.length) break;

      await this.service.MoveItems(
        result.Items.map((item) => new ItemId(item.Id!.UniqueId)),
        this.toFolderId(target),
      );

      offset += result.Items.length;
      more = result.MoreAvailable || false;
    }
  }

  async permanentlyDeleteMessages(ids: string[]): Promise<number> {
    if (!this.service) throw new Error('EWS service not connected');

    const itemIds = ids.map((id) => new ItemId(this.decodeId(id).itemId));
    const response: ServiceResponseCollection<any> =
      await this.service.DeleteItems(
        itemIds,
        DeleteMode.HardDelete,
        SendCancellationsMode.SendToNone,
        AffectedTaskOccurrence.AllOccurrences,
      );

    const deleted = response.Responses.filter(
      (item) => item.ErrorCode === ServiceError.NoError,
    ).length;

    return deleted;
  }

  async permanentlyDeleteAllMessages(folder: string): Promise<number> {
    if (!this.service) throw new Error('EWS service not connected');

    const resolved = this.resolveFolderName(folder);
    const view = new ItemView(200, 0);
    view.PropertySet = new PropertySet(BasePropertySet.IdOnly);

    let offset = 0;
    let more = true;
    let deleted = 0;

    while (more) {
      view.Offset = offset;
      const result = await this.service.FindItems(resolved, view);
      if (!result.Items.length) break;

      const response: ServiceResponseCollection<any> =
        await this.service.DeleteItems(
          result.Items.map((item) => new ItemId(item.Id!.UniqueId)),
          DeleteMode.HardDelete,
          SendCancellationsMode.SendToNone,
          AffectedTaskOccurrence.AllOccurrences,
        );

      deleted += response.Responses.filter(
        (item) => item.ErrorCode === ServiceError.NoError,
      ).length;

      offset += result.Items.length;
      more = result.MoreAvailable || false;
    }

    return deleted;
  }
}
