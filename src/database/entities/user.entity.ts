import {
  Entity,
  PrimaryKey,
  Property,
  ManyToMany,
  Collection,
  Enum,
  ManyToOne,
} from '@mikro-orm/core';
import { Role } from './role.entity';
import { OrganizationUnit, UnitLevel } from './organization-unit.entity';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

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

  @ManyToOne(() => OrganizationUnit, { nullable: true })
  orgUnit?: OrganizationUnit;

  @Enum({ items: () => UnitLevel, nullable: true })
  unitAdminLevel?: UnitLevel;

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
