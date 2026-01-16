import { Injectable, ForbiddenException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { RequestContext } from '../context/request.context';
import { User } from '../../database/entities/user.entity';
import { Permission } from '../../database/entities/permission.entity';

@Injectable()
export class PermissionService {
  constructor(
    private readonly context: RequestContext,
    private readonly em: EntityManager,
  ) {}

  /**
   * Assert that the user has permission to perform action(s) on collection.
   * Throws ForbiddenException if denied.
   * 
   * @param collection - Collection or virtual scope name
   * @param action - Single action or array of actions (ALL must pass)
   */
  async assert(collection: string, action: string | string[]): Promise<void> {
    const actions = Array.isArray(action) ? action : [action];
    
    for (const act of actions) {
      const result = await this.can(collection, act);
      
      // If can() returns false or throws, deny
      if (result === false) {
        throw new ForbiddenException(
          `Permission denied: ${act} on ${collection}`
        );
      }
      
      // If can() returns a filter object with constraints, we can't enforce it here
      // (assert is for boolean checks, not filter-based row-level security)
      // For now, we allow it if it returns an object (truthy)
    }
  }

  /**
   * Check if the current user has permission to perform action on collection.
   * 
   * This method resolves the permission chain:
   * 1. Get current user from RequestContext
   * 2. Load user's roles (via users_roles join table)
   * 3. Load permissions for those roles (via roles_permissions join table)
   * 4. Check if any permission matches (collection, action) pair
   * 
   * Returns:
   * - {} (empty object) = allowed with no row-level filters
   * - { filter } = allowed with row-level constraints (future enhancement)
   * - false = denied
   * 
   * @param collection - Collection or virtual scope name (e.g., 'post', 'user', 'reports')
   * @param action - Arbitrary action string (e.g., 'read', 'create', 'export', 'publish')
   * 
   * NOTE: Actions are extensible strings, not limited to CRUD operations.
   * This allows domain-specific permissions like 'publish', 'approve', 'export', etc.
   */
  async can(collection: string, action: string): Promise<any> {
    const user = this.context.user;
    
    // TODO: Add caching layer here to avoid repeated database queries
    // Extension point: Implement Redis/in-memory cache for user permissions
    // Cache key: `user:${userId}:permissions` with TTL
    
    // Public/anonymous access - no user in context
    if (!user || !user.id) {
      // For demo: allow read on certain collections for public users
      // In production, check for a "public" or "anonymous" role in the database
      if (action === 'read' && ['post', 'comment'].includes(collection)) {
        if (collection === 'post') return { status: 'published' };
        return {};
      }
      return false; // Deny by default
    }

    // Load user with roles and permissions from database
    // This performs the RBAC resolution: user → roles → permissions
    const userWithRoles = await this.em.findOne(
      User,
      { id: Number(user.id) },
      {
        populate: ['roles', 'roles.permissions'],
      }
    );

    if (!userWithRoles) {
      return false; // User not found
    }

    // Check if user has a role with the required permission
    // Iterate through all roles assigned to the user
    for (const role of userWithRoles.roles) {
      // Check if this role has a permission matching (collection, action)
      const hasPermission = role.permissions.getItems().some(
        (permission: Permission) =>
          permission.collection === collection && permission.action === action
      );

      if (hasPermission) {
        // Permission granted - return empty object (no row-level filters)
        // TODO: Future enhancement - return filter constraints for row-level security
        // Example: return { authorId: user.id } to limit to user's own records
        return {};
      }
    }

    // No matching permission found - deny access
    return false;
  }

  /**
   * Helper method to check if user has a specific role by name.
   * Useful for simple role-based checks without full permission resolution.
   * 
   * @param roleName - Name of the role to check (e.g., 'admin', 'editor')
   */
  async hasRole(roleName: string): Promise<boolean> {
    const user = this.context.user;
    
    if (!user || !user.id) {
      return false;
    }

    const userWithRoles = await this.em.findOne(
      User,
      { id: Number(user.id) },
      {
        populate: ['roles'],
      }
    );

    if (!userWithRoles) {
      return false;
    }

    return userWithRoles.roles.getItems().some(role => role.name === roleName);
  }
}

