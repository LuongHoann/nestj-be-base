import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
} from '@mikro-orm/core';
import { User } from './user.entity';

/**
 * Reset Password Token entity for split-token password reset flow.
 * 
 * Token format: <token_id>.<token_secret>
 * - token_id: ULID stored in plaintext, indexed for O(1) lookup
 * - token_secret: Random bytes, hashed with argon2 before storage
 * 
 * Security: One-time use only. Old tokens invalidated when new one is created.
 */
@Entity({ tableName: 'reset_password_tokens' })
export class ResetPasswordToken {
  @PrimaryKey()
  id!: number;

  /**
   * Token identifier (ULID format, 26 characters)
   * - Stored in plaintext
   * - Indexed for O(1) lookup
   * - Unique constraint prevents collisions
   */
  @Property({ unique: true, length: 26 })
  @Index()
  tokenId!: string;

  /**
   * Hashed token secret (argon2)
   * - Never stored in plaintext
   * - Used only for verification after lookup by tokenId
   * - NOT indexed (never queried directly)
   */
  @Property()
  secretHash!: string;

  @ManyToOne(() => User)
  user!: User;

  @Property()
  expiresAt!: Date;

  /**
   * One-time use tracking
   * - NULL = unused token
   * - timestamp = token has been used (cannot be reused)
   */
  @Property({ nullable: true })
  usedAt?: Date;

  @Property({ onCreate: () => new Date() })
  createdAt?: Date;
}
