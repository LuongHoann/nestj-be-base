import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { ulid } from 'ulid';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey()
  id: string = ulid();

  @Property({ unique: true })
  email!: string;

  @Property({ default: true })
  isActive: boolean = true;

  @Property({ default: false })
  mailboxInitialized: boolean = false;

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();
}
