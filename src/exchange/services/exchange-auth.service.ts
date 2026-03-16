import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/core';
import { User } from 'src/database/entities/user.entity';
import { DragonflyService } from 'src/common/cache/dragonfly.service';
import { ulid } from 'ulid';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import {
  ExchangeService,
  ExchangeVersion,
  OAuthCredentials,
  WebCredentials,
  Uri,
  WellKnownFolderName,
  Folder,
  FolderView,
  FolderSchema,
  BasePropertySet,
  PropertySet,
  ImpersonatedUserId,
  ConnectingIdType,
} from 'ews-javascript-api';
import { XhrApi } from '@ewsjs/xhr';

// exchange-auth.service.ts
@Injectable()
export class ExchangeAuthService {
  private readonly logger = new Logger(ExchangeAuthService.name);
  private readonly SESSION_TTL = 3600; // 1 hour
  private readonly REFRESH_TTL = 7 * 24 * 3600; // 7 days

  constructor(
    private readonly cache: DragonflyService,
    private readonly configService: ConfigService,
    private readonly em: EntityManager,
  ) {}

  /**
   * Generate secure session token
   */
  private generateSessionToken(): string {
    return ulid(); // or crypto.randomBytes(32).toString('hex')
  }

  /**
   * Derive encryption key from session token
   */
  private async deriveKey(sessionToken: string): Promise<Buffer> {
    const secret = this.configService.get<string>('EXCHANGE_CRED_SECRET');
    if (!secret) {
      throw new Error('EXCHANGE_CRED_SECRET is not configured');
    }

    const hash = await argon2.hash(secret, {
      salt: Buffer.from(sessionToken.slice(0, 16)), // Use part of token as salt
      raw: true,
      hashLength: 32,
      timeCost: 3,
      memoryCost: 65536, // 64 MB
      parallelism: 1,
      type: argon2.argon2id,
    });

    return hash;
  }

  private encrypt(text: string, key: Buffer): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decrypt(encryptedText: string, key: Buffer): string {
    const [ivHex, authTagHex, contentHex] = encryptedText.split(':');
    if (!ivHex || !authTagHex || !contentHex) {
      throw new Error('Invalid encrypted format');
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(contentHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Login and return access and refresh tokens
   */
  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; email: string }> {
    // Ensure user exists and verify password in DB
    const user = await this.em.findOne(User, { email });
    if (!user) {
      // Ném lỗi và ngừng lại nếu người dùng chưa được cấu hình tài khoản (người dùng chưa có bản ghi trên DB)
      throw new UnauthorizedException('Tài khoản không tồn tại trên hệ thống');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hoá');
    }
    
    if (!user.password) {
      user.password = await argon2.hash(password);
      await this.em.persistAndFlush(user);
    } else {
      const valid = await argon2.verify(user.password, password);
      if (!valid) {
        throw new UnauthorizedException('Invalid Exchange credentials');
      }
    }

    const ssoEnabled =
      this.configService.get<string>('EWS_SSO_ENABLED') !== 'false';
    if (ssoEnabled) {
      // 1. Verify credentials against Exchange/EWS (SSO)
      await this.verifyExchangeCredentials(email);
    } else {
      // 1. Verify credentials against Exchange/EWS (basic)
      await this.verifyExchangeCredentialsBasic(email, password);
    }

    // 3. Issue tokens
    return this.issueTokens(email, password);
  }

  /**
   * Internal helper to issue both tokens
   */
  private async issueTokens(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; email: string }> {
    // A. Issue Access Token (Session)
    const accessToken = this.generateSessionToken();
    const accessKey = await this.deriveKey(accessToken);
    const encryptedEmail = this.encrypt(email, accessKey);
    const encryptedPass = this.encrypt(password, accessKey);

    await this.cache.set(
      `exchange:session:${accessToken}`,
      { e: encryptedEmail, p: encryptedPass, createdAt: Date.now() },
      this.SESSION_TTL,
    );

    // B. Issue Refresh Token
    const tokenId = ulid();
    const tokenSecret = crypto.randomBytes(32).toString('base64url');
    const secretHash = await argon2.hash(tokenSecret);

    // We encrypt credentials for the refresh token record too, using tokenId as salt basis
    const refreshKey = await this.deriveKey(tokenId);
    const re = this.encrypt(email, refreshKey);
    const rp = this.encrypt(password, refreshKey);

    await this.cache.set(
      `exchange:refresh:${tokenId}`,
      { h: secretHash, e: re, p: rp },
      this.REFRESH_TTL,
    );

    return {
      email,
      accessToken,
      refreshToken: `${tokenId}.${tokenSecret}`,
    };
  }

  /**
   * Rotate refresh token
   */
  async rotateRefreshToken(
    fullToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [tokenId, tokenSecret] = fullToken.split('.');

    if (!tokenId || !tokenSecret) {
      throw new UnauthorizedException('Token không hợp lệ !');
    }

    const stored = await this.cache.get<{ h: string; e: string; p: string }>(
      `exchange:refresh:${tokenId}`,
    );

    if (!stored) {
      throw new UnauthorizedException('Token đã hết hạn hoặc không tồn tại !');
    }

    // Verify secret
    const isValid = await argon2.verify(stored.h, tokenSecret);
    if (!isValid) {
      throw new UnauthorizedException('Token không hợp lệ !');
    }

    // Decrypt credentials from refresh record
    try {
      const key = await this.deriveKey(tokenId);
      const email = this.decrypt(stored.e, key);
      const password = this.decrypt(stored.p, key);

      // Revoke old refresh token
      await this.cache.del(`exchange:refresh:${tokenId}`);

      // Issue new tokens
      this.logger.log(`Exchange tokens rotated for ${email}`);
      return this.issueTokens(email, password);
    } catch (error) {
      this.logger.error(`Failed to rotate exchange token: ${error.message}`);
      throw new UnauthorizedException('Không thể làm mới token !');
    }
  }

  /**
   * Verify Exchange credentials
   */
  private async verifyExchangeCredentials(email: string): Promise<void> {
    const ssoEnabled =
      this.configService.get<string>('EWS_SSO_ENABLED') !== 'false';
    if (!ssoEnabled) {
      return;
    }
    const validate = this.configService.get<boolean>('EWS_VALIDATE_ON_LOGIN');
    if (!validate) {
      this.logger.log(`Skip EWS validation for ${email}`);
      return;
    }

    const service = await this.createEwsService(email);
    try {
      await Folder.Bind(service, WellKnownFolderName.Inbox);
      this.logger.log(`EWS authentication successful for ${email}`);
    } catch (error) {
      this.logger.warn(
        `EWS authentication failed for ${email}: ${error.message}`,
      );
      throw new UnauthorizedException('Invalid Exchange credentials');
    }
  }

  async createSessionFromCredentials(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.issueTokens(email, password);
  }

  async ensureMailboxExists(email: string, password?: string): Promise<void> {
    const service = await this.createEwsService(email, password);
    await Folder.Bind(service, WellKnownFolderName.Inbox);
  }

  private async createEwsService(
    email: string,
    password?: string,
  ): Promise<ExchangeService> {
    const rejectUnauthorized =
      this.configService.get<string>('EWS_TLS_REJECT_UNAUTHORIZED') !== 'false';
    if (!rejectUnauthorized) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const url = this.configService.get<string>('EWS_URL');
    const tokenUrl = this.configService.get<string>('EWS_TOKEN_URL');
    const clientId = this.configService.get<string>('EWS_CLIENT_ID');
    const clientSecret = this.configService.get<string>('EWS_CLIENT_SECRET');
    const scope = this.configService.get<string>('EWS_SCOPE');
    const resource = this.configService.get<string>('EWS_RESOURCE');
    const version =
      this.configService.get<string>('EWS_VERSION') || 'Exchange2019';

    if (!url) {
      throw new Error('EWS_URL is not configured');
    }

    (ExchangeService as any).XHRApi = new XhrApi();
    const service = new ExchangeService(
      ExchangeVersion[version as keyof typeof ExchangeVersion] ||
        ExchangeVersion.Exchange2016,
    );
    const ssoEnabled =
      this.configService.get<string>('EWS_SSO_ENABLED') !== 'false';
    if (ssoEnabled) {
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
    } else {
      if (!password) {
        throw new UnauthorizedException('Missing password for basic auth');
      }
      service.Credentials = new WebCredentials(email, password);
    }
    service.Url = new Uri(url);

    if (
      this.configService.get<string>('EWS_IMPERSONATE') === 'true' &&
      ssoEnabled
    ) {
      service.ImpersonatedUserId = new ImpersonatedUserId(
        ConnectingIdType.SmtpAddress,
        email,
      );
    }

    return service;
  }

  private async verifyExchangeCredentialsBasic(
    email: string,
    password: string,
  ): Promise<void> {
    const service = await this.createEwsService(email, password);
    try {
      await Folder.Bind(service, WellKnownFolderName.Inbox);
      this.logger.log(`EWS basic authentication successful for ${email}`);
    } catch (error) {
      this.logger.warn(
        `EWS basic authentication failed for ${email}: ${error.message}`,
      );
      throw new UnauthorizedException('Invalid Exchange credentials');
    }
  }


  /**
   * Get credentials by session token
   */
  async getCredentials(
    sessionToken: string,
  ): Promise<{ email: string; password: string } | null> {
    const session = await this.cache.get<{
      e: string;
      p: string;
      createdAt: number;
    }>(`exchange:session:${sessionToken}`);

    if (!session) {
      return null;
    }

    try {
      const key = await this.deriveKey(sessionToken);
      const email = this.decrypt(session.e, key);
      const password = this.decrypt(session.p, key);

      return { email, password };
    } catch (error) {
      this.logger.error(
        `Failed to decrypt credentials for session ${sessionToken}`,
      );
      await this.logout(sessionToken); // Clean up corrupted session
      return null;
    }
  }

  /**
   * Refresh session TTL
   */
  async refreshSession(sessionToken: string): Promise<boolean> {
    const session = await this.cache.get(`exchange:session:${sessionToken}`);
    if (!session) {
      return false;
    }

    await this.cache.expire(
      `exchange:session:${sessionToken}`,
      this.SESSION_TTL,
    );
    return true;
  }

  /**
   * Logout and clear session
   */
  async logout(sessionToken: string): Promise<void> {
    await this.cache.del(`exchange:session:${sessionToken}`);
    this.logger.log(`Session ${sessionToken} terminated`);
  }

  /**
   * Validate session exists and is valid
   */
  async validateSession(sessionToken: string): Promise<boolean> {
    const exists = await this.cache.exists(`exchange:session:${sessionToken}`);
    return exists;
  }
}
