// guards/exchange-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ExchangeAuthService } from '../../exchange/services/exchange-auth.service';

@Injectable()
export class ExchangeAuthGuard implements CanActivate {
  constructor(private readonly authService: ExchangeAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieToken = request.cookies?.['exchange_session'];
    const authHeader = request.headers?.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : undefined;
    const sessionToken = cookieToken || bearerToken;

    if (!sessionToken) {
      throw new UnauthorizedException('No session token provided');
    }

    const isValid = await this.authService.validateSession(sessionToken);
    
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Refresh session on each request
    await this.authService.refreshSession(sessionToken);
    
    // Attach session token to request
    request['exchangeSession'] = sessionToken;
    
    return true;
  }
}
