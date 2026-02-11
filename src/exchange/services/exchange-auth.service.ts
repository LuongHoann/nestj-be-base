import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DragonflyService } from 'src/common/cache/dragonfly.service';
import { ulid } from 'ulid';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

// exchange-auth.service.ts
@Injectable()
export class ExchangeAuthService {
  private readonly logger = new Logger(ExchangeAuthService.name);
  private readonly SESSION_TTL = 3600; // 1 hour
  private readonly REFRESH_TTL = 7 * 24 * 3600; // 7 days

  constructor(
    private readonly cache: DragonflyService,
    private readonly configService: ConfigService,
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
      type: argon2.argon2id
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

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(contentHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Login and return access and refresh tokens
   */
  async login(email: string, password: string): Promise<{ accessToken: string, refreshToken: string ,email: string}> {
    // 1. Verify credentials against Exchange/IMAP
    await this.verifyExchangeCredentials(email, password);

    // 2. Issue tokens
    return this.issueTokens(email, password);
  }

  /**
   * Internal helper to issue both tokens
   */
  private async issueTokens(email: string, password: string): Promise<{ accessToken: string, refreshToken: string ,email: string}> {
    // A. Issue Access Token (Session)
    const accessToken = this.generateSessionToken();
    const accessKey = await this.deriveKey(accessToken);
    const encryptedEmail = this.encrypt(email, accessKey);
    const encryptedPass = this.encrypt(password, accessKey);

    await this.cache.set(
      `exchange:session:${accessToken}`, 
      { e: encryptedEmail, p: encryptedPass, createdAt: Date.now() }, 
      this.SESSION_TTL
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
      this.REFRESH_TTL
    );

    return { 
      email,
      accessToken, 
      refreshToken: `${tokenId}.${tokenSecret}` 
    };
  }

  /**
   * Rotate refresh token
   */
  async rotateRefreshToken(fullToken: string): Promise<{ accessToken: string, refreshToken: string }> {
    const [tokenId, tokenSecret] = fullToken.split('.');
    
    if (!tokenId || !tokenSecret) {
      throw new UnauthorizedException('Token không hợp lệ !');
    }

    const stored = await this.cache.get<{ h: string, e: string, p: string }>(
      `exchange:refresh:${tokenId}`
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
  private async verifyExchangeCredentials(email: string, password: string): Promise<void> {
    const host = this.configService.get<string>('IMAP_HOST');
    const port = this.configService.get<number>('IMAP_PORT', 993);
    const secure = this.configService.get<boolean>('IMAP_SECURE', true);
    
    if (!host) {
      throw new Error('IMAP_HOST is not configured');
    }

    const { ImapFlow } = await import('imapflow');
    const client = new ImapFlow({
      host,
      port,
      secure,
      auth: {
        user: email,
        pass: password,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false
      },
      logger: false,
    });

    try {
      await client.connect();
      await client.logout();
      this.logger.log(`Exchange authentication successful for ${email}`);
    } catch (error) {
      this.logger.warn(`Exchange authentication failed for ${email}: ${error.message}`);
      throw new UnauthorizedException('Invalid Exchange credentials');
    }
  }

  /**
   * Get credentials by session token
   */
  async getCredentials(sessionToken: string): Promise<{email: string, password: string} | null> {
    const session = await this.cache.get<{e: string, p: string, createdAt: number}>(
      `exchange:session:${sessionToken}`
    );
    
    if (!session) {
      return null;
    }

    try {
      const key = await this.deriveKey(sessionToken);
      const email = this.decrypt(session.e, key);
      const password = this.decrypt(session.p, key);
      
      return { email, password };
    } catch (error) {
      this.logger.error(`Failed to decrypt credentials for session ${sessionToken}`);
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
    
    await this.cache.expire(`exchange:session:${sessionToken}`, this.SESSION_TTL);
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