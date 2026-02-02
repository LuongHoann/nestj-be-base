import { Injectable, ForbiddenException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { RequestContext } from '../context/request.context';
import { User } from '../../database/entities/user.entity';
import { Permission } from '../../database/entities/permission.entity';
import { actionTranslations, collectionTranslations } from '../localization/vi';
import { DragonflyService } from '../cache/dragonfly.service';

@Injectable()
export class PermissionService {
  constructor(
    private readonly context: RequestContext,
    private readonly em: EntityManager,
    private readonly cache: DragonflyService,
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
        const translatedCollection =
          collectionTranslations[collection] || collection;
        const translatedAction = actionTranslations[act] || act;
        throw new ForbiddenException(
          `Bạn không có quyền ${translatedAction} trên ${translatedCollection}`,
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
   * This allows domain-specific permissions like 'publish', 'approve', 'export', etc.
   */
  async can(collection: string, action: string): Promise<any> {
    const user = this.context.user;
    
    // Public/anonymous access - no user in context
    if (!user || !user.id) {
      // For demo: allow read on certain collections for public users
      if (action === 'read' && ['post', 'comment'].includes(collection)) {
        if (collection === 'post') return { status: 'published' };
        return {};
      }
      return false; // Deny by default
    }

    // -------------------------------------------------------------
    // CACHE LAYER: Try to get permissions from cache first
    // -------------------------------------------------------------
    const cacheKey = `user:${user.id}:permissions`;
    // Cache structure: { "collection_name": ["action1", "action2"], ... }
    const cachedPermissions = await this.cache.get<Record<string, string[]>>(cacheKey);

    if (cachedPermissions) {
      // CACHE HIT: O(1) lookup for collection
      const collectionActions = cachedPermissions[collection];
      if (collectionActions && collectionActions.includes(action)) {
        return {}; // Allowed
      }
      return false; 
    }

    // -------------------------------------------------------------
    // DB FALLBACK: Load from database
    // -------------------------------------------------------------

    // Load user with roles and permissions from database
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

    // Build optimized Map: Collection -> Actions[]
    const permissionMap: Record<string, string[]> = {};
    
    for (const role of userWithRoles.roles) {
      for (const permission of role.permissions) {
        if (!permissionMap[permission.collection]) {
          permissionMap[permission.collection] = [];
        }
        // Avoid duplicate actions
        if (!permissionMap[permission.collection].includes(permission.action)) {
          permissionMap[permission.collection].push(permission.action);
        }
      }
    }

    // Save to cache (DragonflyDB)
    await this.cache.set(cacheKey, permissionMap);

    // Check current request: O(1) lookup
    const actions = permissionMap[collection];
    if (actions && actions.includes(action)) {
      return {};
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

