import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/core';
import { JwtService } from '@nestjs/jwt';
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
import { ImapFlow } from 'imapflow';
import { XhrApi } from '@ewsjs/xhr';

// exchange-auth.service.ts
export type MailProviderType = 'ews' | 'imap';

@Injectable()
export class ExchangeAuthService {
  private readonly logger = new Logger(ExchangeAuthService.name);
  private readonly SESSION_TTL = 3600; // 1 hour
  private readonly REFRESH_TTL = 7 * 24 * 3600; // 7 days

  private normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  private getBasicIdentityCacheKey(email: string): string {
    return `exchange:basic-identity:${this.normalizeEmail(email)}`;
  }

  private getMailProviderPreference(): 'auto' | MailProviderType {
    const configured =
      this.configService.get<string>('MAIL_PROVIDER')?.trim().toLowerCase() ||
      'auto';

    if (configured === 'ews' || configured === 'imap') {
      return configured;
    }

    return 'auto';
  }

  private buildBasicAuthIdentityCandidates(email: string): string[] {
    const normalizedEmail = this.normalizeEmail(email);
    const [localPart = '', domainPart = ''] = normalizedEmail.split('@');
    const configuredDomain =
      this.configService.get<string>('EWS_BASIC_AUTH_DOMAIN')?.trim() || '';
    const configuredUpnSuffix =
      this.configService.get<string>('EWS_BASIC_AUTH_UPN_SUFFIX')?.trim() || '';
    const inferredNetbiosDomain = domainPart.split('.')[0] || '';
    const domainForSam = configuredDomain || inferredNetbiosDomain;

    const candidates = [
      normalizedEmail,
      configuredUpnSuffix && localPart
        ? `${localPart}@${configuredUpnSuffix.toLowerCase()}`
        : '',
      domainForSam && localPart ? `${domainForSam}\\${localPart}` : '',
      localPart,
    ];

    return Array.from(
      new Set(
        candidates
          .map((candidate) => candidate.trim())
          .filter(Boolean),
      ),
    );
  }

  private async getCachedBasicAuthIdentity(email: string): Promise<string | null> {
    const cached = await this.cache.get<{ identity?: string }>(
      this.getBasicIdentityCacheKey(email),
    );
    return cached?.identity?.trim() || null;
  }

  private async cacheBasicAuthIdentity(
    email: string,
    identity: string,
  ): Promise<void> {
    await this.cache.set(
      this.getBasicIdentityCacheKey(email),
      { identity },
      this.REFRESH_TTL,
    );
  }

  private buildImapConfig(authUser: string, password: string) {
    return {
      host: this.configService.get<string>('IMAP_HOST', 'outlook.office365.com'),
      port: this.configService.get<number>('IMAP_PORT', 993),
      secure: this.configService.get<string>('IMAP_SECURE', 'true') !== 'false',
      auth: {
        user: authUser,
        pass: password,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      },
      logger: false,
    };
  }

  private buildDefaultName(email: string): string {
    return email.split('@')[0] || email;
  }

  private async ensureLocalUser(email: string): Promise<User> {
    let user = await this.em.findOne(User, { email });

    if (!user) {
      user = this.em.create(User, {
        email,
        name: this.buildDefaultName(email),
        isActive: true,
        mailboxInitialized: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.em.persistAndFlush(user);
      this.logger.log(`Provisioned local webmail user for ${email}`);
    }

    if (!user.isActive) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hoá');
    }

    return user;
  }

  constructor(
    private readonly cache: DragonflyService,
    private readonly configService: ConfigService,
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
  ) { }

  private async issueAppAccessToken(email: string): Promise<string> {
    const user = await this.em.findOne(User, { email });

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại trên hệ thống');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hoá');
    }

    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
  }

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
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    email: string;
    appAccessToken: string;
  }> {
    const ssoEnabled =
      this.configService.get<string>('EWS_SSO_ENABLED') !== 'false';
    let exchangeAuthIdentity = this.normalizeEmail(email);
    let mailProvider: MailProviderType = 'ews';

    if (ssoEnabled) {
      // 1. Verify credentials against Exchange/EWS (SSO)
      exchangeAuthIdentity = await this.verifyExchangeCredentials(email);
    } else {
      const providerPreference = this.getMailProviderPreference();

      if (providerPreference === 'imap') {
        exchangeAuthIdentity = await this.verifyImapCredentials(email, password);
        mailProvider = 'imap';
      } else {
        try {
          exchangeAuthIdentity = await this.verifyExchangeCredentialsBasic(
            email,
            password,
          );
        } catch (error) {
          if (providerPreference !== 'auto') {
            throw error;
          }

          this.logger.warn(
            `EWS basic auth rejected ${email}. Falling back to IMAP authentication.`,
          );
          exchangeAuthIdentity = await this.verifyImapCredentials(
            email,
            password,
          );
          mailProvider = 'imap';
        }
      }
    }

    const user = await this.ensureLocalUser(email);

    if (!user.password || !(await argon2.verify(user.password, password))) {
      user.password = await argon2.hash(password);
      await this.em.persistAndFlush(user);
    }

    // 2. Ensure mailbox folders are initialized once per account
    await this.initializeMailboxIfNeeded(
      email,
      password,
      exchangeAuthIdentity,
      mailProvider,
    );

    // 3. Issue tokens
    const tokens = await this.issueTokens(
      email,
      password,
      exchangeAuthIdentity,
      mailProvider,
    );

    return {
      ...tokens,
      appAccessToken: await this.issueAppAccessToken(email),
    };
  }

  /**
   * Internal helper to issue both tokens
   */
  private async issueTokens(
    email: string,
    password: string,
    authIdentity?: string,
    mailProvider: MailProviderType = 'ews',
  ): Promise<{ accessToken: string; refreshToken: string; email: string }> {
    // A. Issue Access Token (Session)
    const accessToken = this.generateSessionToken();
    const accessKey = await this.deriveKey(accessToken);
    const encryptedEmail = this.encrypt(email, accessKey);
    const encryptedPass = this.encrypt(password, accessKey);
    const normalizedAuthIdentity = (authIdentity || email).trim();
    const encryptedAuthIdentity = this.encrypt(normalizedAuthIdentity, accessKey);

    await this.cache.set(
      `exchange:session:${accessToken}`,
      {
        e: encryptedEmail,
        p: encryptedPass,
        u: encryptedAuthIdentity,
        m: mailProvider,
        createdAt: Date.now(),
      },
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
    const ru = this.encrypt(normalizedAuthIdentity, refreshKey);

    await this.cache.set(
      `exchange:refresh:${tokenId}`,
      { h: secretHash, e: re, p: rp, u: ru, m: mailProvider },
      this.REFRESH_TTL,
    );

    await this.cacheBasicAuthIdentity(email, normalizedAuthIdentity);

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
  ): Promise<{ accessToken: string; refreshToken: string; appAccessToken: string }> {
    const [tokenId, tokenSecret] = fullToken.split('.');

    if (!tokenId || !tokenSecret) {
      throw new UnauthorizedException('Token không hợp lệ !');
    }

    const stored = await this.cache.get<{
      h: string;
      e: string;
      p: string;
      u?: string;
      m?: MailProviderType;
    }>(
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
      const authIdentity = stored.u
        ? this.decrypt(stored.u, key)
        : (await this.getCachedBasicAuthIdentity(email)) || email;
      const mailProvider = stored.m === 'imap' ? 'imap' : 'ews';

      // Revoke old refresh token
      await this.cache.del(`exchange:refresh:${tokenId}`);

      // Issue new tokens
      this.logger.log(`Exchange tokens rotated for ${email}`);
      const tokens = await this.issueTokens(
        email,
        password,
        authIdentity,
        mailProvider,
      );

      return {
        ...tokens,
        appAccessToken: await this.issueAppAccessToken(email),
      };
    } catch (error) {
      this.logger.error(`Failed to rotate exchange token: ${error.message}`);
      throw new UnauthorizedException('Không thể làm mới token !');
    }
  }

  /**
   * Verify Exchange credentials
   */
  private async verifyExchangeCredentials(email: string): Promise<string> {
    const ssoEnabled =
      this.configService.get<string>('EWS_SSO_ENABLED') !== 'false';
    if (!ssoEnabled) {
      return this.normalizeEmail(email);
    }
    const validate = this.configService.get<boolean>('EWS_VALIDATE_ON_LOGIN');
    if (!validate) {
      this.logger.log(`Skip EWS validation for ${email}`);
      return this.normalizeEmail(email);
    }

    const service = await this.createEwsService(email);
    try {
      await Folder.Bind(service, WellKnownFolderName.Inbox);
      this.logger.log(`EWS authentication successful for ${email}`);
      return this.normalizeEmail(email);
    } catch (error) {
      this.logger.warn(
        `EWS authentication failed for ${email}: ${error.message}`,
      );
      throw new UnauthorizedException('Invalid Exchange credentials');
    }
  }

  private async initializeMailboxIfNeeded(
    email: string,
    password: string,
    authIdentity?: string,
    mailProvider: MailProviderType = 'ews',
  ): Promise<void> {
    const user = await this.em.findOne(User, { email });

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại trên hệ thống');
    }

    if (user.mailboxInitialized) {
      return;
    }

    if (mailProvider !== 'ews') {
      user.mailboxInitialized = false;
      await this.em.persistAndFlush(user);
      return;
    }

    try {
      const service = await this.createEwsService(email, password, authIdentity);
      await this.ensureSystemFolders(service);
      user.mailboxInitialized = true;
    } catch (error) {
      this.logger.warn(
        `Failed to verify default folders for ${email}: ${error.message}`,
      );
      user.mailboxInitialized = false;
    }

    await this.em.persistAndFlush(user);
  }

  async createSessionFromCredentials(
    email: string,
    password: string,
    authIdentity?: string,
    mailProvider: MailProviderType = 'ews',
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.issueTokens(email, password, authIdentity, mailProvider);
  }

  async ensureMailboxExists(
    email: string,
    password?: string,
    authIdentity?: string,
    mailProvider: MailProviderType = 'ews',
  ): Promise<void> {
    if (mailProvider === 'imap') {
      if (!password) {
        throw new UnauthorizedException('Missing password for IMAP auth');
      }

      await this.verifyImapCredentials(email, password, authIdentity);
      return;
    }

    const service = await this.createEwsService(email, password, authIdentity);
    await Folder.Bind(service, WellKnownFolderName.Inbox);
  }

  async resolveAuthIdentity(
    email: string,
    authIdentity?: string,
  ): Promise<string> {
    if (authIdentity?.trim()) {
      return authIdentity.trim();
    }

    return (await this.getCachedBasicAuthIdentity(email)) || this.normalizeEmail(email);
  }

  async resolveMailProvider(
    sessionToken: string,
  ): Promise<MailProviderType> {
    const credentials = await this.getCredentials(sessionToken);
    return credentials?.mailProvider === 'imap' ? 'imap' : 'ews';
  }

  private async createEwsService(
    email: string,
    password?: string,
    authIdentity?: string,
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
      service.Credentials = new WebCredentials(authIdentity || email, password);
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
  ): Promise<string> {
    const cachedIdentity = await this.getCachedBasicAuthIdentity(email);
    const candidates = cachedIdentity
      ? [cachedIdentity, ...this.buildBasicAuthIdentityCandidates(email)]
      : this.buildBasicAuthIdentityCandidates(email);

    let lastError: unknown;

    for (const candidate of candidates) {
      const service = await this.createEwsService(email, password, candidate);

      try {
        await Folder.Bind(service, WellKnownFolderName.Inbox);
        await this.cacheBasicAuthIdentity(email, candidate);
        this.logger.log(
          `EWS basic authentication successful for ${email} using identity ${candidate}`,
        );
        return candidate;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `EWS basic authentication failed for ${email} using identity ${candidate}: ${error.message}`,
        );
      }
    }

    throw new UnauthorizedException(
      lastError instanceof Error && lastError.message
        ? `Invalid Exchange credentials`
        : 'Invalid Exchange credentials',
    );
  }

  private async verifyImapCredentials(
    email: string,
    password: string,
    authIdentity?: string,
  ): Promise<string> {
    const prioritizedCandidates = authIdentity?.trim()
      ? [authIdentity.trim(), ...this.buildBasicAuthIdentityCandidates(email)]
      : this.buildBasicAuthIdentityCandidates(email);
    const candidates = Array.from(new Set(prioritizedCandidates));

    let lastError: unknown;

    for (const candidate of candidates) {
      const client = new ImapFlow(this.buildImapConfig(candidate, password) as any);

      try {
        await client.connect();
        await client.logout();
        await this.cacheBasicAuthIdentity(email, candidate);
        this.logger.log(
          `IMAP authentication successful for ${email} using identity ${candidate}`,
        );
        return candidate;
      } catch (error) {
        lastError = error;
        try {
          await client.logout();
        } catch {
          // ignore disconnect errors after failed auth
        }
        this.logger.warn(
          `IMAP authentication failed for ${email} using identity ${candidate}: ${error.message}`,
        );
      }
    }

    throw new UnauthorizedException(
      lastError instanceof Error && lastError.message
        ? 'Invalid Exchange credentials'
        : 'Invalid Exchange credentials',
    );
  }

  private async ensureSystemFolders(service: ExchangeService): Promise<void> {
    const targetFolders = [
      WellKnownFolderName.Inbox,
      WellKnownFolderName.SentItems,
      WellKnownFolderName.Drafts,
      WellKnownFolderName.DeletedItems,
      WellKnownFolderName.JunkEmail,
    ];

    const view = new FolderView(200);
    view.PropertySet = new PropertySet(
      BasePropertySet.IdOnly,
      FolderSchema.DisplayName,
    );

    const result = await service.FindFolders(
      WellKnownFolderName.MsgFolderRoot,
      view,
    );

    const existing = new Set(
      result.Folders.map((folder) => folder.DisplayName?.toLowerCase() || ''),
    );

    for (const name of targetFolders) {
      if (!existing.has(String(name).toLowerCase())) {
        // Attempt to bind to ensure system folders exist; Exchange normally creates them.
        await Folder.Bind(service, name);
      }
    }
  }

  /**
   * Get credentials by session token
   */
  async getCredentials(
    sessionToken: string,
  ): Promise<{
    email: string;
    password: string;
    authIdentity: string;
    mailProvider: MailProviderType;
  } | null> {
    const session = await this.cache.get<{
      e: string;
      p: string;
      u?: string;
      m?: MailProviderType;
      createdAt: number;
    }>(`exchange:session:${sessionToken}`);

    if (!session) {
      return null;
    }

    try {
      const key = await this.deriveKey(sessionToken);
      const email = this.decrypt(session.e, key);
      const password = this.decrypt(session.p, key);
      const authIdentity = session.u
        ? this.decrypt(session.u, key)
        : (await this.getCachedBasicAuthIdentity(email)) || email;
      const mailProvider = session.m === 'imap' ? 'imap' : 'ews';

      return { email, password, authIdentity, mailProvider };
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
