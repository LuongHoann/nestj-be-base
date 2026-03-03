import {
  Injectable,
  Logger,
  Scope,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { EwsMailProvider } from './ews-mail.provider';
import { DragonflyService } from '../../common/cache/dragonfly.service';
import { ExchangeAuthService } from './exchange-auth.service';
import {
  ExchangeContact,
  ExchangeNote,
  ExchangeSearchResult,
} from '../interfaces/contact-note.interface';

@Injectable({ scope: Scope.REQUEST })
export class ContactNoteService {
  private readonly logger = new Logger(ContactNoteService.name);
  private readonly CONTACT_COUNT_TTL = 300;

  constructor(
    private readonly provider: EwsMailProvider,
    private readonly dragonfly: DragonflyService,
    private readonly authService: ExchangeAuthService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private async withProvider<T>(operation: () => Promise<T>): Promise<T> {
    try {
      await this.provider.connect();
      return await operation();
    } catch (error) {
      this.logger.error(
        `Exchange operation failed: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await this.provider.disconnect();
    }
  }

  private async getEmailFromSession(): Promise<string | null> {
    const token = this.request.cookies?.['exchange_session'];
    if (!token) return null;
    const creds = await this.authService.getCredentials(token);
    return creds?.email || null;
  }

  private getContactsCountCacheKey(email: string): string {
    return `exchange:contacts:count:${email}`;
  }

  private async refreshContactsCountCache(email: string): Promise<void> {
    if (!this.dragonfly.enabled) return;
    const total = await this.withProvider(() =>
      this.provider.getContactsCount(),
    );
    await this.dragonfly.set(
      this.getContactsCountCacheKey(email),
      total,
      this.CONTACT_COUNT_TTL,
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
    if (!payload.email) {
      throw new BadRequestException('Email is required');
    }
    const result = await this.withProvider(() =>
      this.provider.createContact(payload),
    );

    const email = await this.getEmailFromSession();
    if (email && this.dragonfly.enabled) {
      await this.refreshContactsCountCache(email);
    }

    return result;
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
    return this.withProvider(() => this.provider.updateContact(id, payload));
  }

  async deleteContact(id: string): Promise<{ success: boolean }> {
    await this.withProvider(() => this.provider.deleteContact(id));

    const email = await this.getEmailFromSession();
    if (email && this.dragonfly.enabled) {
      await this.refreshContactsCountCache(email);
    }

    return { success: true };
  }

  async getContactByEmail(email: string): Promise<ExchangeContact | null> {
    return this.withProvider(() => this.provider.getContactByEmail(email));
  }

  async getContactById(id: string): Promise<ExchangeContact | null> {
    return this.withProvider(() => this.provider.getContactById(id));
  }

  async searchContacts(
    keyword: string,
    page: number,
    pageSize: number,
  ): Promise<ExchangeSearchResult<ExchangeContact>> {
    return this.withProvider(() =>
      this.provider.searchContacts(keyword, page, pageSize),
    );
  }

  async getContactsCount(): Promise<{ total: number }> {
    const email = await this.getEmailFromSession();
    if (email && this.dragonfly.enabled) {
      const key = this.getContactsCountCacheKey(email);
      const cached = await this.dragonfly.get<number>(key);
      if (cached !== null) {
        return { total: cached };
      }

      const total = await this.withProvider(() =>
        this.provider.getContactsCount(),
      );
      await this.dragonfly.set(key, total, this.CONTACT_COUNT_TTL);
      return { total };
    }

    const total = await this.withProvider(() =>
      this.provider.getContactsCount(),
    );
    return { total };
  }

  async listNotes(
    page: number,
    pageSize: number,
  ): Promise<ExchangeSearchResult<ExchangeNote>> {
    return this.withProvider(() => this.provider.listNotes(page, pageSize));
  }

  async createNote(payload: {
    subject?: string;
    content: string;
  }): Promise<ExchangeNote> {
    if (!payload.content) {
      throw new BadRequestException('Content is required');
    }
    return this.withProvider(() => this.provider.createNote(payload));
  }

  async updateNote(
    id: string,
    payload: { subject?: string; content?: string },
  ): Promise<ExchangeNote> {
    return this.withProvider(() => this.provider.updateNote(id, payload));
  }

  async deleteNote(id: string): Promise<{ success: boolean }> {
    await this.withProvider(() => this.provider.deleteNote(id));
    return { success: true };
  }
}
