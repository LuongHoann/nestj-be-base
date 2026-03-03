import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ExchangeService,
  ExchangeVersion,
  OAuthCredentials,
  WebCredentials,
  Uri,
  ResolveNameSearchLocation,
} from 'ews-javascript-api';
import { XhrApi } from '@ewsjs/xhr';

(ExchangeService as any).XHRApi = new XhrApi();

@Injectable()
export class GalService {
  constructor(private readonly configService: ConfigService) {}

  async search(query: string): Promise<{ name: string; email: string }[]> {
    if (!query?.trim()) return [];
    const service = await this.createService();

    const response = await service.ResolveName(
      query,
      ResolveNameSearchLocation.DirectoryOnly,
      true,
    );

    const resolutions = response?.GetEnumerator?.() ?? [];
    return resolutions
      .map((r: any) => ({
        name: r?.Mailbox?.Name ?? '',
        email: r?.Mailbox?.Address ?? '',
      }))
      .filter((r: any) => r.email);
  }

  private async createService(): Promise<ExchangeService> {
    const rejectUnauthorized =
      this.configService.get<string>('EWS_TLS_REJECT_UNAUTHORIZED') !== 'false';
    if (!rejectUnauthorized) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const url = this.configService.get<string>('EWS_URL');
    if (!url) {
      throw new Error('EWS_URL is not configured');
    }

    const version =
      this.configService.get<string>('EWS_VERSION') || 'Exchange2016';

    const service = new ExchangeService(
      ExchangeVersion[version as keyof typeof ExchangeVersion] ||
        ExchangeVersion.Exchange2016,
    );
    service.Url = new Uri(url);

    const ssoEnabled =
      this.configService.get<string>('EWS_SSO_ENABLED') !== 'false';
    if (ssoEnabled) {
      const tokenUrl = this.configService.get<string>('EWS_TOKEN_URL');
      const clientId = this.configService.get<string>('EWS_CLIENT_ID');
      const clientSecret = this.configService.get<string>('EWS_CLIENT_SECRET');
      const scope = this.configService.get<string>('EWS_SCOPE');
      const resource = this.configService.get<string>('EWS_RESOURCE');

      if (!tokenUrl || !clientId || !clientSecret) {
        throw new Error('EWS OAuth2 config is missing');
      }

      const body = new URLSearchParams();
      body.set('client_id', clientId);
      body.set('client_secret', clientSecret);
      body.set('grant_type', 'client_credentials');
      if (scope) {
        body.set('scope', scope);
      } else if (resource) {
        body.set('resource', resource);
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new UnauthorizedException(`Failed to fetch EWS token: ${text}`);
      }

      const payload = (await response.json()) as { access_token: string };
      service.Credentials = new OAuthCredentials(payload.access_token);
      return service;
    }

    const adminEmail = this.configService.get<string>('EWS_ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('EWS_ADMIN_PASSWORD');
    if (!adminEmail || !adminPassword) {
      throw new Error('EWS_ADMIN_EMAIL/EWS_ADMIN_PASSWORD is not configured');
    }

    service.Credentials = new WebCredentials(adminEmail, adminPassword);
    return service;
  }
}
