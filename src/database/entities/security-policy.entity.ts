import { Entity, PrimaryKey, Property, Enum } from '@mikro-orm/core';

export enum SecurityPolicyType {
  WHITELIST = 'WHITELIST',
  BLACKLIST = 'BLACKLIST',
}

export enum SecurityTargetType {
  DOMAIN = 'DOMAIN',
  EMAIL = 'EMAIL',
}

/**
 * Entity lưu trữ các chính sách bảo mật mở rộng.
 * Dùng để cấu hình Whitelist/Blacklist theo Domain hoặc Email.
 */
@Entity({ tableName: 'security_policies' })
export class SecurityPolicy {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Enum({ items: () => SecurityPolicyType })
  type!: SecurityPolicyType;

  @Enum({ items: () => SecurityTargetType })
  targetType!: SecurityTargetType;

  @Property()
  value!: string; // Email address or Domain name

  @Property()
  createdBy!: string; // Email của Admin tạo rule

  @Property({ nullable: true })
  reason?: string;

  @Property()
  createdAt: Date = new Date();

  constructor(
    type: SecurityPolicyType,
    targetType: SecurityTargetType,
    value: string,
    createdBy: string,
    reason?: string,
  ) {
    this.type = type;
    this.targetType = targetType;
    this.value = value;
    this.createdBy = createdBy;
    this.reason = reason;
  }
}
