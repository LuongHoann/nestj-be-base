import {
  Entity,
  PrimaryKey,
  Property,
  ManyToMany,
  Collection,
} from '@mikro-orm/core';
import { User } from './user.entity';
import { Permission } from './permission.entity';

/**
 * Role entity for RBAC system.
 * Roles group permissions and are assigned to users.
 * Examples: 'admin', 'editor', 'viewer', 'custom_role'
 */
@Entity({ tableName: 'roles' })
export class Role {
  @PrimaryKey()
  id!: number;

  /**
   * Unique role name (e.g., 'admin', 'editor')
   * Used for role identification and assignment
   */
  @Property({ unique: true })
  name!: string;

  /**
   * Optional human-readable description of the role's purpose
   */
  @Property({ nullable: true })
  description?: string;

  /**
   * Users assigned to this role (many-to-many)
   * Managed via users_roles join table
   */
  @ManyToMany(() => User, (user) => user.roles)
  users = new Collection<User>(this);

  /**
   * Permissions granted by this role (many-to-many)
   * Managed via roles_permissions join table
   */
  @ManyToMany(() => Permission, (permission) => permission.roles, {
    owner: true,
  })
  permissions = new Collection<Permission>(this);
}
