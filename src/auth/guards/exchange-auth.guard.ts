// guards/exchange-auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { User } from '../../database/entities/user.entity';
import { ExchangeAuthService } from '../../exchange/services/exchange-auth.service';

@Injectable()
export class ExchangeAuthGuard implements CanActivate {
  constructor(
    private readonly authService: ExchangeAuthService,
    private readonly em: EntityManager,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>();
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

    const credentials = await this.authService.getCredentials(sessionToken);

    if (!credentials) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Lấy thông tin user từ DB để có ID (cần cho RSS)
    const user = await this.em.findOne(User, { email: credentials.email });
    if (!user) {
      throw new UnauthorizedException('User not found in database');
    }

    // Refresh session on each request
    await this.authService.refreshSession(sessionToken);

    // Attach user and session token to request
    request.user = {
      id: user.id,
      email: credentials.email,
    };
    request['exchangeSession'] = sessionToken;

    return true;
  }
}
