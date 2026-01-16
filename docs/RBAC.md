# RBAC Persistence Layer - Implementation Guide

## Overview

This document explains the RBAC (Role-Based Access Control) persistence layer implementation for the NestJS application. The system provides a flexible, database-backed permission system using MikroORM and PostgreSQL.

## Database Schema

### Tables

The RBAC system consists of 5 tables:

1. **`user`** - Extended with RBAC support
   - `id` (PK)
   - `name`
   - `email` (unique)
   - `password` (hashed, hidden from serialization)
   - `created_at`
   - `updated_at`

2. **`role`** - Role definitions
   - `id` (PK)
   - `name` (unique) - e.g., 'admin', 'editor', 'viewer'
   - `description` (nullable)

3. **`permission`** - Permission definitions
   - `id` (PK)
   - `collection` - Entity/resource scope (e.g., 'post', 'user', 'reports')
   - `action` - Operation allowed (e.g., 'read', 'create', 'export', 'publish')
   - `description` (nullable)
   - **Index**: Composite index on `(collection, action)` for efficient lookups

4. **`user_roles`** - Many-to-many join table
   - `user_id` (FK → users.id, PK)
   - `role_id` (FK → roles.id, PK)
   - Composite primary key on `(user_id, role_id)`

5. **`role_permissions`** - Many-to-many join table
   - `role_id` (FK → roles.id, PK)
   - `permission_id` (FK → permissions.id, PK)
   - Composite primary key on `(role_id, permission_id)`

### Entity Relationships

```
User ←→ Role ←→ Permission
 (M:N)     (M:N)
```

- A user can have multiple roles
- A role can be assigned to multiple users
- A role can have multiple permissions
- A permission can belong to multiple roles

## Design Decisions

### Why (collection, action) Model?

The permission system uses a `(collection, action)` pair instead of traditional resource-based permissions:

**Benefits:**

1. **Extensibility**: Actions are strings, not enums - add new actions without schema changes
2. **Flexibility**: Supports domain-specific actions beyond CRUD (e.g., 'publish', 'approve', 'export')
3. **Virtual Collections**: Collections aren't limited to database tables - can represent logical scopes (e.g., 'reports', 'analytics')
4. **Simplicity**: Easy to understand and query

**Examples:**

- `('post', 'read')` - Can read posts
- `('post', 'publish')` - Can publish posts (custom action)
- `('user', 'delete')` - Can delete users
- `('reports', 'export')` - Can export reports (virtual collection)

### Why Extensible Actions?

Actions are stored as strings rather than predefined enums to allow:

- Custom business logic actions (e.g., 'approve_invoice', 'generate_report')
- Workflow-specific operations (e.g., 'submit_for_review', 'archive')
- Future extensibility without database migrations

## Files Created

### Entities

- [`role.entity.ts`](file:///c:/Users/Simax/OneDrive/Máy%20tính/nestjs-base-be/src/database/entities/role.entity.ts) - Role entity with ManyToMany relations
- [`permission.entity.ts`](file:///c:/Users/Simax/OneDrive/Máy%20tính/nestjs-base-be/src/database/entities/permission.entity.ts) - Permission entity with (collection, action) model
- [`user.entity.ts`](file:///c:/Users/Simax/OneDrive/Máy%20tính/nestjs-base-be/src/database/entities/user.entity.ts) - Updated with password field and roles relation

### Migrations

- [`Migration20260116012800.ts`](file:///c:/Users/Simax/OneDrive/Máy%20tính/nestjs-base-be/src/database/migrations/Migration20260116012800.ts) - Creates all RBAC tables with indexes and constraints

### Services

- [`permission.service.ts`](file:///c:/Users/Simax/OneDrive/Máy%20tính/nestjs-base-be/src/common/permissions/permission.service.ts) - Updated to query RBAC database

## Usage

### PermissionService API

The `PermissionService` provides two main methods:

#### 1. `can(collection: string, action: string): Promise<any>`

Checks if the current user has permission to perform an action on a collection.

**Returns:**

- `{}` (empty object) = Permission granted, no row-level filters
- `{ filter }` = Permission granted with row-level constraints (future enhancement)
- `false` = Permission denied

**Example:**

```typescript
const result = await permissionService.can('post', 'publish');
if (result === false) {
  // User cannot publish posts
} else {
  // User can publish posts
}
```

#### 2. `assert(collection: string, action: string | string[]): Promise<void>`

Asserts that the user has permission. Throws `ForbiddenException` if denied.

**Example:**

```typescript
// Single action
await permissionService.assert('post', 'delete');

// Multiple actions (ALL must pass)
await permissionService.assert('post', ['read', 'update']);
```

#### 3. `hasRole(roleName: string): Promise<boolean>`

Helper method to check if user has a specific role.

**Example:**

```typescript
if (await permissionService.hasRole('admin')) {
  // User is an admin
}
```

### Permission Resolution Flow

When `can()` or `assert()` is called:

1. **Get current user** from `RequestContext`
2. **Load user's roles** from database (via `user_roles` join table)
3. **Load permissions** for those roles (via `role_permissions` join table)
4. **Check permission** - Does any role have a permission matching `(collection, action)`?
5. **Return result** - Grant or deny access

## Running Migrations

### Install Dependencies

```bash
npm install --save-dev @mikro-orm/cli @mikro-orm/migrations
```

### Run Migration

```bash
npm run migration:up
```

### Rollback Migration

```bash
npm run migration:down
```

## Future Enhancements

### Caching Layer (TODO)

The `PermissionService.can()` method includes extension points for caching:

```typescript
// TODO: Add caching layer here to avoid repeated database queries
// Extension point: Implement Redis/in-memory cache for user permissions
// Cache key: `user:${userId}:permissions` with TTL
```

**Recommended approach:**

- Cache user permissions in Redis with TTL (e.g., 5 minutes)
- Invalidate cache on role/permission changes
- Cache key format: `user:{userId}:permissions`

### Row-Level Security (TODO)

Future enhancement to return filter constraints:

```typescript
// Example: Limit to user's own records
return { authorId: user.id };
```

This would integrate with the QueryEngine to automatically filter results.

## NON-GOALS

The following features are **NOT** implemented (as per requirements):

- ❌ Field-level permissions
- ❌ Permission inheritance trees
- ❌ UI management logic
- ❌ Admin screens or seed scripts

## Testing

### Example: Creating Roles and Permissions

```typescript
// Create a role
const editorRole = em.create(Role, {
  name: 'editor',
  description: 'Can create and edit content',
});

// Create permissions
const readPostPermission = em.create(Permission, {
  collection: 'post',
  action: 'read',
  description: 'Can read posts',
});

const publishPostPermission = em.create(Permission, {
  collection: 'post',
  action: 'publish',
  description: 'Can publish posts',
});

// Assign permissions to role
editorRole.permissions.add(readPostPermission, publishPostPermission);

// Assign role to user
user.roles.add(editorRole);

await em.flush();
```

### Example: Checking Permissions

```typescript
// In a controller or service
const canPublish = await this.permissionService.can('post', 'publish');
if (canPublish) {
  // User can publish posts
}

// Or use assert to throw exception if denied
await this.permissionService.assert('post', 'publish');
```

## Summary

The RBAC persistence layer provides:

✅ Database-backed role and permission management  
✅ Flexible (collection, action) permission model  
✅ Extensible actions (not limited to CRUD)  
✅ Many-to-many relationships (users ↔ roles ↔ permissions)  
✅ Efficient database queries with composite indexes  
✅ Integration with existing PermissionService  
✅ Extension points for caching and row-level security  
✅ Comprehensive migrations for schema management

The system is ready for production use and can be extended with caching, row-level security, and custom permission logic as needed.
