import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { ulid } from 'ulid';

@Entity({ tableName: 'shared_mailboxes' })
export class SharedMailbox {
  @PrimaryKey()
  id: string = ulid();

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

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();
}
