import {
  Entity,
  PrimaryKey,
  Property,
  ManyToMany,
  Collection,
  Index,
} from '@mikro-orm/core';
import { Role } from './role.entity';

/**
 * Permission entity for RBAC system.
 * 
 * Permissions are defined by (collection, action) pairs:
 * - collection: The entity/resource scope (e.g., 'post', 'user', 'report')
 * - action: The operation allowed (e.g., 'read', 'create', 'delete', 'export', 'publish')
 * 
 * WHY (collection + action)?
 * This design provides flexibility and extensibility:
 * 1. Collections map to entities or logical scopes (not just database tables)
 * 2. Actions are extensible strings, not limited to CRUD operations
 * 3. Custom actions can be added without schema changes (e.g., 'export', 'publish', 'approve')
 * 4. Supports virtual collections for cross-entity operations (e.g., 'reports', 'analytics')
 * 
 * WHY actions are strings?
 * - Extensible: Add new actions without modifying the schema
 * - Flexible: Support domain-specific actions beyond CRUD
 * - Simple: Easy to understand and query
 * 
 * Examples:
 * - ('post', 'read') - Can read posts
 * - ('post', 'publish') - Can publish posts (custom action)
 * - ('user', 'delete') - Can delete users
 * - ('reports', 'export') - Can export reports (virtual collection)
 */
@Entity({ tableName: 'permissions' })
@Index({ properties: ['collection', 'action'] }) // Composite index for efficient permission lookups
export class Permission {
  @PrimaryKey()
  id!: number;

  /**
   * The entity or logical scope this permission applies to.
   * Examples: 'post', 'user', 'comment', 'reports', 'analytics'
   * Can be entity names or virtual scopes for grouped operations.
   */
  @Property()
  collection!: string;

  /**
   * The action/operation allowed on the collection.
   * Extensible string - not limited to CRUD operations.
   * Examples: 'read', 'create', 'update', 'delete', 'publish', 'export', 'approve'
   */
  @Property()
  action!: string;

  /**
   * Optional human-readable description of what this permission grants
   */
  @Property({ nullable: true })
  description?: string;

  /**
   * Roles that have this permission (many-to-many)
   * Managed via roles_permissions join table
   */
  @ManyToMany(() => Role, (role) => role.permissions)
  roles = new Collection<Role>(this);
}
