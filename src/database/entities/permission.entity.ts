import {
  Entity,
  PrimaryKey,
  Property,
  ManyToMany,
  Collection,
  Index,
} from '@mikro-orm/core';
import { Role } from './role.entity';

@Entity({ tableName: 'permissions' })
@Index({
  name: 'permissions_collection_action_index',
  properties: ['collection', 'action'],
})
export class Permission {
  @PrimaryKey()
  id!: number;

  @Property()
  collection!: string;

  @Property()
  action!: string;

  @Property({ nullable: true })
  description?: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles = new Collection<Role>(this);
}
