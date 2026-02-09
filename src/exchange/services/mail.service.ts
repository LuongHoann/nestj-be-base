import { Injectable, Logger } from '@nestjs/common';
import { ImapMailProvider } from './imap-mail.provider';
import { MailMessage } from '../interfaces/mail-provider.interface';
import { SendMailDto } from '../dto/exchange.dto';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly provider: ImapMailProvider) {}

  private async withProvider<T>(operation: () => Promise<T>): Promise<T> {
      try {
          await this.provider.connect();
          return await operation();
      } catch (error) {
          this.logger.error(`Mail operation failed: ${error.message}`, error.stack);
          throw error;
      } finally {
          await this.provider.disconnect();
      }
  }

  async getFolders() {
      return this.withProvider(() => this.provider.getFolders());
  }

  async getMessages(folderType: string, page: number = 1, pageSize: number = 20) {
      // Map folderType to ID if needed, but provider expects ID.
      // Our provider "getFolders" returns IDs like 'INBOX', 'Sent Items'.
      // The frontend calls with 'inbox', 'sent', 'drafts', 'trash'.
      // We need to map these to the provider IDs.
      
      let folderId = 'INBOX';
      switch(folderType.toLowerCase()) {
          case 'inbox': folderId = 'INBOX'; break;
          case 'sent': folderId = 'Sent Items'; break;
          case 'drafts': folderId = 'Drafts'; break;
          case 'trash': folderId = 'Deleted Items'; break;
          case 'spam': folderId = 'Spam'; break;
          default: folderId = 'INBOX'; // Default fallthrough or specific handling
      }

      return this.withProvider(() => this.provider.getMessages(folderId, page, pageSize));
  }

  async getMessage(id: string) {
      return this.withProvider(() => this.provider.getMessage(id));
  }

  async sendMessage(dto: SendMailDto) {
      return this.withProvider(() => this.provider.sendMessage(dto));
  }
  
  async searchMessages(query: string, page: number = 1, pageSize: number = 20) {
      return this.withProvider(() => this.provider.search(query, page, pageSize));
  }

  async moveMessage(messageId: string, targetFolderType: string) {
      // Map folder type to actual folder ID
      let targetFolderId = 'INBOX';
      switch(targetFolderType.toLowerCase()) {
          case 'inbox': targetFolderId = 'INBOX'; break;
          case 'sent': targetFolderId = 'Sent Items'; break;
          case 'drafts': targetFolderId = 'Drafts'; break;
          case 'trash': targetFolderId = 'Deleted Items'; break;
          case 'spam': targetFolderId = 'Spam'; break;
          default: targetFolderId = targetFolderType; // Allow direct folder ID
      }

      return this.withProvider(() => this.provider.moveMessage(messageId, targetFolderId));
  }
}
