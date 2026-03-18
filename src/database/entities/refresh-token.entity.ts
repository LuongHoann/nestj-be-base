import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Index,
} from '@mikro-orm/core';
import { User } from './user.entity';

/**
 * Refresh Token entity for split-token authentication.
 * 
 * Token format: <token_id>.<token_secret>
 * - token_id: ULID stored in plaintext, indexed for O(1) lookup
 * - token_secret: Random bytes, hashed with argon2 before storage
 * 
 * Security: Never query by secret_hash. Always lookup by token_id first.
 */
@Entity({ tableName: 'refresh_tokens' })
export class RefreshToken {
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
   * Revocation timestamp
   * - NULL = active token
   * - timestamp = revoked token (cannot be used)
   */
  @Property({ nullable: true })
  revokedAt?: Date;

  @Property({ onCreate: () => new Date() })
  createdAt?: Date
}
