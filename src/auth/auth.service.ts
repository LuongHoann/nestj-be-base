import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EntityManager } from '@mikro-orm/core';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { ulid } from 'ulid';
import { User } from '../database/entities/user.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { ResetPasswordToken } from '../database/entities/reset-password-token.entity';

/**
 * AuthService - Handles authentication with split-token refresh mechanism.
 * 
 * Token Strategy:
 * - Access tokens: JWT, short-lived (15 min)
 * - Refresh tokens: Split-token format <token_id>.<token_secret>
 *   - token_id: ULID, stored in plaintext, indexed for O(1) lookup
 *   - token_secret: Random bytes, hashed with argon2
 * 
 * Security: All token verification uses O(1) indexed lookup by token_id.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly em: EntityManager,
  ) {}

  /**
   * Issue both access and refresh tokens for a user.
   * 
   * @param userId - User ID to issue tokens for
   * @returns Object with accessToken (JWT) and refreshToken (split-token)
   */
  async issueTokens(userId: number): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // 1. Generate JWT access token
    const accessToken = this.jwtService.sign({ sub: userId });

    // 2. Generate split refresh token
    const tokenId = ulid();
    const tokenSecret = randomBytes(32).toString('base64url');
    const secretHash = await argon2.hash(tokenSecret);

    // 3. Store in database
    const refreshTokenEntity = this.em.create(RefreshToken, {
      tokenId,
      secretHash,
      user: userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
    await this.em.persistAndFlush(refreshTokenEntity);

    // 4. Return combined token to client
    const refreshToken = `${tokenId}.${tokenSecret}`;

    return { accessToken, refreshToken };
  }

  /**
   * Rotate refresh token - verify old token and issue new tokens.
   * 
   * Security: O(1) lookup by token_id, then constant-time verification.
   * Old token is immediately revoked.
   * 
   * @param fullToken - Full refresh token in format <token_id>.<token_secret>
   * @returns New access and refresh tokens
   */
  async rotateRefreshToken(fullToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // 1. Parse token into components
    const [tokenId, tokenSecret] = fullToken.split('.');

    if (!tokenId || !tokenSecret) {
      throw new UnauthorizedException('Invalid token format');
    }

    // 2. O(1) lookup by token_id (SINGLE ROW QUERY)
    const storedToken = await this.em.findOne(RefreshToken, {
      tokenId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 3. Verify secret using constant-time comparison
    const isValid = await argon2.verify(storedToken.secretHash, tokenSecret);

    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 4. Revoke old token immediately
    storedToken.revokedAt = new Date();

    // 5. Issue new tokens
    const newTokens = await this.issueTokens(storedToken.user.id);

    await this.em.flush();

    return newTokens;
  }

  /**
   * Revoke a refresh token (used for logout).
   * 
   * @param fullToken - Full refresh token to revoke
   */
  async revokeRefreshToken(fullToken: string): Promise<void> {
    const [tokenId, tokenSecret] = fullToken.split('.');

    if (!tokenId || !tokenSecret) {
      return; // Silent fail for logout
    }

    // O(1) lookup
    const storedToken = await this.em.findOne(RefreshToken, {
      tokenId,
      revokedAt: null,
    });

    if (!storedToken) {
      return; // Already revoked or doesn't exist
    }

    // Verify secret
    const isValid = await argon2.verify(storedToken.secretHash, tokenSecret);

    if (!isValid) {
      return; // Invalid token, nothing to revoke
    }

    // Revoke
    storedToken.revokedAt = new Date();
    await this.em.flush();
  }

  /**
   * Create a reset password token for a user.
   * Invalidates any existing reset tokens for this user.
   * 
   * @param userId - User ID to create reset token for
   * @returns Reset token in format <token_id>.<token_secret>
   */
  async createResetPasswordToken(userId: number): Promise<string> {
    // 1. Invalidate any existing reset tokens for this user
    await this.em.nativeUpdate(
      ResetPasswordToken,
      { user: userId, usedAt: null },
      { usedAt: new Date() }
    );

    // 2. Generate split token
    const tokenId = ulid();
    const tokenSecret = randomBytes(32).toString('base64url');
    const secretHash = await argon2.hash(tokenSecret);

    // 3. Store in database
    const resetTokenEntity = this.em.create(ResetPasswordToken, {
      tokenId,
      secretHash,
      user: userId,
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
    });
    await this.em.persistAndFlush(resetTokenEntity);

    // 4. Return combined token
    return `${tokenId}.${tokenSecret}`;
  }

  /**
   * Reset user password using a reset token.
   * Token is one-time use only.
   * 
   * @param fullToken - Reset token in format <token_id>.<token_secret>
   * @param newPassword - New password (will be hashed)
   */
  async resetPassword(fullToken: string, newPassword: string): Promise<void> {
    // 1. Parse token
    const [tokenId, tokenSecret] = fullToken.split('.');

    if (!tokenId || !tokenSecret) {
      throw new BadRequestException('Invalid token format');
    }

    // 2. O(1) lookup
    const storedToken = await this.em.findOne(ResetPasswordToken, {
      tokenId,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!storedToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // 3. Verify secret
    const isValid = await argon2.verify(storedToken.secretHash, tokenSecret);

    if (!isValid) {
      throw new BadRequestException('Invalid reset token');
    }

    // 4. Mark as used (one-time use)
    storedToken.usedAt = new Date();

    // 5. Update password
    const passwordHash = await argon2.hash(newPassword);
    await this.em.nativeUpdate(
      User,
      { id: storedToken.user.id },
      { password: passwordHash }
    );

    await this.em.flush();
  }

  /**
   * Login user with email and password.
   * 
   * @param email - User email
   * @param password - User password (plaintext)
   * @returns Access and refresh tokens
   */
  async login(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.em.findOne(User, { email });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await argon2.verify(user.password, password);

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user.id);
  }

  /**
   * Get user by ID (for /auth/me endpoint).
   * 
   * @param userId - User ID
   * @returns User object
   */
  async getMe(userId: number): Promise<User> {
    const user = await this.em.findOne(User, { id: userId });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
