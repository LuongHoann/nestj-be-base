import { Injectable, ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../context/request.context';

@Injectable()
export class PermissionService {
  constructor(private readonly context: RequestContext) {}

  /**
   * Assert that the user has permission to perform action(s) on collection.
   * Throws ForbiddenException if denied.
   * 
   * @param collection - Collection or virtual scope name
   * @param action - Single action or array of actions (ALL must pass)
   */
  assert(collection: string, action: string | string[]): void {
    const actions = Array.isArray(action) ? action : [action];
    
    for (const act of actions) {
      const result = this.can(collection, act);
      
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
   * Returns:
   * - {} (empty object) = allowed with no row-level filters
   * - { filter } = allowed with row-level constraints
   * - false = denied
   * 
   * @param collection - Collection or virtual scope name
   * @param action - Arbitrary action string (e.g., 'read', 'export', 'publish', 'custom:generate_report')
   */
  can(collection: string, action: string): any {
    const user = this.context.user;
    
    // Admin bypass
    if (user && user.role === 'admin') {
      return {}; // No filter, full access
    }

    // Public access (simplified logic for demo)
    if (!user) {
      // For demo: allow read on 'posts' and 'comments' if published?
      // In real world, check public permissions config
      if (action === 'read' && ['post', 'comment'].includes(collection)) {
         if (collection === 'post') return { status: 'published' };
         return {};
      }
      return false; // Deny
    }

    // User Logged in - logic for demo
    // If accessing own data?
    if (collection === 'user' && action === 'read') {
        // Can only read own profile unless admin? context-aware filter
        return { id: user.id };
    }

    // Custom action examples (extensible)
    if (action === 'export') {
      // Only allow export for authenticated users
      return user ? {} : false;
    }

    if (action === 'publish') {
      // Only allow publish for users with role 'editor' or 'admin'
      return user && ['editor', 'admin'].includes(user.role) ? {} : false;
    }

    // Default: allow for authenticated users, deny for anonymous
    return user ? {} : false;
  }
}
