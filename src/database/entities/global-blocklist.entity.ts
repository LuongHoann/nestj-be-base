import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';

/**
 * Entity lưu trữ danh sách chặn toàn cục (Global Blacklist).
 * Dữ liệu ở đây là nguồn chính để rebuild sang Redis.
 */
@Entity({ tableName: 'global_blocklist' })
export class GlobalBlocklist {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property()
  @Unique()
  senderEmail: string;

  @Property()
  blockedBy: string; // Email của Admin thực hiện chặn

  @Property({ nullable: true })
  reason?: string;

  @Property()
  createdAt: Date = new Date();

  constructor(senderEmail: string, blockedBy: string, reason?: string) {
    this.senderEmail = senderEmail;
    this.blockedBy = blockedBy;
    this.reason = reason;
  }
}
