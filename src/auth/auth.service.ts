import { Injectable, UnauthorizedException, Logger, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EntityManager } from '@mikro-orm/core';
import { User } from '../database/entities/user.entity';
import { AuditLogService } from '../audit/audit.service';
import * as argon2 from 'argon2';
import { ExchangeAuthService } from '../exchange/services/exchange-auth.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly em: EntityManager,
    private readonly auditLogService: AuditLogService,
    private readonly exchangeAuthService: ExchangeAuthService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    exchangeAccessToken: string;
    exchangeRefreshToken: string;
  }> {
    const user = await this.em.findOne(User, { email });
    if (!user || !user.password) {
      await this.auditLogService.logAuth(null, 'login_failed', { email });
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ!');
    }

    if (!user.isActive) {
      await this.auditLogService.logAuth(user.id, 'login_failed', { email });
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hoá');
    }

    const isValid = await argon2.verify(user.password, password);
    if (!isValid) {
      await this.auditLogService.logAuth(user.id, 'login_failed', { email });
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ!');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    const exchangeTokens =
      await this.exchangeAuthService.createSessionFromCredentials(
        user.email,
        password,
      );

    await this.auditLogService.logAuth(user.id, 'login', { email });

    return {
      accessToken,
      exchangeAccessToken: exchangeTokens.accessToken,
      exchangeRefreshToken: exchangeTokens.refreshToken,
    };
  }

  async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<User> {
    const existing = await this.em.findOne(User, { email });
    if (existing) {
      throw new ConflictException('Email đã tồn tại!');
    }

    // Ensure mailbox exists in Exchange (EWS). This does not provision a mailbox.
    await this.exchangeAuthService.ensureMailboxExists(email, password);

    const hash = await argon2.hash(password);
    const now = new Date();

    const user = this.em.create(User, {
      email,
      password: hash,
      name,
      isActive: true,
      mailboxInitialized: false,
      createdAt: now,
      updatedAt: now,
    });

    await this.em.persistAndFlush(user);
    await this.auditLogService.logAuth(user.id, 'login', { email, action: 'register' });
    return user;
  }

  async getMe(userId: string): Promise<User> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại !');
    }
    return user;
  }
}
