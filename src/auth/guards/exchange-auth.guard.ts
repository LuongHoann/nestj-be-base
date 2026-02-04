// guards/exchange-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ExchangeAuthService } from '../../exchange/services/exchange-auth.service';

@Injectable()
export class ExchangeAuthGuard implements CanActivate {
  constructor(private readonly authService: ExchangeAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionToken = request.cookies?.['exchange_session'];

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