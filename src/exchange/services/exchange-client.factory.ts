import { Injectable, Scope, Inject, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ExchangeService, ExchangeVersion, Uri } from 'ews-javascript-api';
import { ExchangeAuthService } from './exchange-auth.service';
import { RequestContext } from '../../common/context/request.context';

@Injectable({ scope: Scope.REQUEST })
export class ExchangeClientFactory {
  private client: ExchangeService | null = null;

  constructor(
    private readonly authService: ExchangeAuthService,
    private readonly configService: ConfigService,
    @Inject(REQUEST) private readonly request: any,
    private readonly context: RequestContext, // Use RequestContext for userId
  ) {}

  async createClient(): Promise<ExchangeService> {
    if (this.client) return this.client;

    const user = this.context.user;
    if (!user || !user.id) {
        throw new UnauthorizedException('User context required for Exchange access');
    }

    const credentials = await this.authService.getStoredCredentials(String(user.id));
    if (!credentials) {
        throw new UnauthorizedException('Exchange session expired or invalid. Please login to Webmail.');
    }

    const exch = new ExchangeService(ExchangeVersion.Exchange2013);
    exch.Credentials = credentials;
    
    const ewsUrl = this.configService.get<string>('EWS_URL');
        if (ewsUrl) {
            exch.Url = new Uri(ewsUrl);
        } else {
             // Fallback for MVP if URL not in env, try standard O365 or autodiscover logic (simplified)
             // For MVP robustness, we strongly recommend EWS_URL env.
             // But we can try to rely on credentials domain.
             // exch.AutodiscoverUrl(...) is async/callback based in this lib, hard to use in sync factory flow 
             // without wrapping. 
             // We'll enforce EWS_URL or throw for now to keep MVP stable (or auto-discover if not present)
             
             // Since Autodiscover is complex, we will assume EWS_URL is provided or default to O365
             exch.Url = new Uri("https://outlook.office365.com/EWS/Exchange.asmx");
        }

    this.client = exch;
    return exch;
  }
}
