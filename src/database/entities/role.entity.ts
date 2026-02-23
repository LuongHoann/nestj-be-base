import { Entity, PrimaryKey, Property, ManyToMany, Collection } from '@mikro-orm/core';
import { Permission } from './permission.entity';
import { User } from './user.entity';

@Entity({ tableName: 'roles' })
export class Role {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ nullable: true })
  description?: string;

  @ManyToMany(() => Permission, (permission) => permission.roles, {
    owner: true,
    pivotTable: 'roles_permissions',
  })
  permissions = new Collection<Permission>(this);

  @ManyToMany(() => User, (user) => user.roles)
  users = new Collection<User>(this);
}
