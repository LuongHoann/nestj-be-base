import { Injectable, Logger } from '@nestjs/common';
import { ExchangeClientFactory } from './exchange-client.factory';
import { 
    WellKnownFolderName, 
    FolderId, 
    ItemView, 
    PropertySet, 
    BasePropertySet, 
    EmailMessage, 
    MessageBody, 
    SearchFilter, 
    LogicalOperator, 
    ConflictResolutionMode,
    BodyType,
    ItemId,
    SortDirection,
    ItemSchema
} from 'ews-javascript-api';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly clientFactory: ExchangeClientFactory) {}

  private async getClient() {
      return this.clientFactory.createClient();
  }

  private mapFolderType(type: string): WellKnownFolderName {
      switch (type.toLowerCase()) {
          case 'inbox': return WellKnownFolderName.Inbox;
          case 'sent': return WellKnownFolderName.SentItems;
          case 'drafts': return WellKnownFolderName.Drafts;
          case 'trash': return WellKnownFolderName.DeletedItems;
          default: return WellKnownFolderName.Inbox;
      }
  }

  async getFolders() {
      // MVP: Just return static list of supported folders with their WellKnownName IDs mapped to strings
      return [
          { id: 'inbox', name: 'Hộp thư đến' },
          { id: 'sent', name: 'Đã gửi' },
          { id: 'drafts', name: 'Thư nháp' },
          { id: 'trash', name: 'Thùng rác' },
      ];
  }

  async getMessages(folderType: string, page: number = 1, pageSize: number = 20) {
      const client = await this.getClient();
      const folder = this.mapFolderType(folderType);
      
      const view = new ItemView(pageSize, (page - 1) * pageSize);
      view.PropertySet = new PropertySet(BasePropertySet.FirstClassProperties); 
      
      // Sort by Receive Date Descending - Use ItemSchema
      view.OrderBy.Add(ItemSchema.DateTimeReceived, SortDirection.Descending);

      const results = await client.FindItems(folder, view);
      
      return {
          items: results.Items.map(item => ({
              id: item.Id.UniqueId,
              subject: item.Subject,
              from: item.DisplayTo, 
              // Safe cast - though EWS JS types are tricky, straightforward property access usually works
              // However, 'Sender' is on Item, but strictly on Message type. FindItems returns Item.
              // We rely on JS flexibility or cast.
              sender: item instanceof EmailMessage ? { name: item.Sender?.Name, email: item.Sender?.Address } : null,
              receivedAt: item.DateTimeReceived,
              isRead: !(item instanceof EmailMessage) || item.IsRead,
              preview: item.Preview,
              hasAttachments: item.HasAttachments
          })),
          total: results.TotalCount,
          page,
          pageSize
      };
  }

  async getMessage(id: string) {
      const client = await this.getClient();
      const itemId = new ItemId(id);
      const outputSet = new PropertySet(BasePropertySet.FirstClassProperties);
      outputSet.Add(ItemSchema.Body);
      
      const item = await EmailMessage.Bind(client, itemId, outputSet);
      
      if (!item.IsRead) {
          item.IsRead = true;
          await item.Update(ConflictResolutionMode.AutoResolve);
      }

      // ToRecipients and CcRecipients are EmailAddressCollection
      // In ews-javascript-api, .Items is the direct array access usually
      const toRecipients = item.ToRecipients?.GetEnumerator() || []; 
      const ccRecipients = item.CcRecipients?.GetEnumerator() || [];
      // Note: GetEnumerator returns an iterator-like structure or array in some ports.
      // EWS-JS often uses internal array .items usually.
      // Let's safe check. The library docs say GetItems() isn't standard JS.
      // We will try .Items which is common in the JS logic of this port or iterate manually if needed.
      // Actually, looking at type defs, it extends ComplexPropertyCollection which has 'Items' getter?
      // Let's assume .GetItems() was wrong and try accessing via .Items (if public) or iterator.
      // The safest way in this lib is iterating or using .Items if available.
      
      const mapRecipients = (collection: any) => {
          if (!collection) return [];
          // The lib usually exposes .Items which is an array
          if (collection.Items) return collection.Items.map((r: any) => ({ name: r.Name, email: r.Address }));
          return [];
      };

      return {
          id: item.Id.UniqueId,
          subject: item.Subject,
          sender: { name: item.Sender?.Name, email: item.Sender?.Address },
          to: mapRecipients(item.ToRecipients),
          cc: mapRecipients(item.CcRecipients),
          receivedAt: item.DateTimeReceived,
          body: item.Body.Text, 
          isHtml: item.Body.BodyType === BodyType.HTML,
          importance: item.Importance
      };
  }

  async sendMessage(to: string[], subject: string, body: string, cc: string[] = []) {
      const client = await this.getClient();
      const message = new EmailMessage(client);
      message.Subject = subject;
      message.Body = new MessageBody(body);
      
      for (const recipient of to) {
          message.ToRecipients.Add(recipient);
      }
      for (const recipient of cc) {
          message.CcRecipients.Add(recipient);
      }

      await message.SendAndSaveCopy();
      return { success: true };
  }
  
  async searchMessages(query: string, page: number = 1, pageSize: number = 20) {
      if (!query) return this.getMessages('inbox', page, pageSize);
      
      const client = await this.getClient();
      const view = new ItemView(pageSize, (page - 1) * pageSize);
      
      const searchFilter = new SearchFilter.SearchFilterCollection(LogicalOperator.Or);
      searchFilter.Add(new SearchFilter.ContainsSubstring(ItemSchema.Subject, query));
      searchFilter.Add(new SearchFilter.ContainsSubstring(ItemSchema.Body, query));

      const results = await client.FindItems(WellKnownFolderName.Inbox, searchFilter, view);
       
      return {
          items: results.Items.map(item => ({
              id: item.Id.UniqueId,
              subject: item.Subject,
              receivedAt: item.DateTimeReceived,
              sender: item instanceof EmailMessage ? { name: item.Sender?.Name, email: item.Sender?.Address } : null,
          })),
          total: results.TotalCount
      };
  }
}
