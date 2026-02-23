import {
  Entity,
  PrimaryKey,
  Property,
  ManyToMany,
  Collection,
} from '@mikro-orm/core';
import { ulid } from 'ulid';
import { Role } from './role.entity';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey()
  id: string = ulid();

  @Property({ unique: true })
  email!: string;

  @Property({ nullable: true })
  name?: string;

  @Property({ nullable: true, hidden: true })
  password?: string;

  @Property({ default: true })
  isActive: boolean = true;

  @Property({ default: false })
  mailboxInitialized: boolean = false;

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();

  @ManyToMany(() => Role, (role) => role.users, {
    owner: true,
    pivotTable: 'user_roles',
  })
  roles = new Collection<Role>(this);
}
