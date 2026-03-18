import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { OrganizationUnit } from './organization-unit.entity';

@Entity({ tableName: 'shared_mailboxes' })
export class SharedMailbox {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property()
  name!: string;

  @Property({ unique: true })
  email!: string;

  @Property()
  displayName!: string;

  @Property({ nullable: true })
  exchangeGuid?: string;

  @Property({ default: true })
  isActive: boolean = true;

  @Property({ nullable: true })
  createdBy?: string;

  @ManyToOne(() => OrganizationUnit, { nullable: true })
  orgUnit?: OrganizationUnit;

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();
}
