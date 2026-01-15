# RBAC Action Model - Documentation

## Overview

The permission system supports **arbitrary action strings**, not just CRUD operations. This allows you to define custom permissions for any business operation.

## Core Concepts

### 1. Actions are Strings

Actions can be any string that represents a permission-controlled operation:

- Standard CRUD: `'read'`, `'create'`, `'update'`, `'delete'`
- Export/Import: `'export'`, `'import'`
- Publishing: `'publish'`, `'unpublish'`, `'approve'`
- System operations: `'rebuild_index'`, `'clear_cache'`
- Custom namespaced: `'custom:generate_report'`, `'admin:manage_users'`

### 2. Permission Methods

#### `assert(collection, action)`

Throws `ForbiddenException` if permission is denied. Use for boolean checks.

```typescript
// Single action
permissionService.assert('posts', 'publish');

// Multiple actions (ALL must pass)
permissionService.assert('reports', ['read', 'export']);
```

#### `can(collection, action)`

Returns filter constraints or boolean. Use for row-level security.

```typescript
const filter = permissionService.can('posts', 'read');
// Returns:
// - {} = allowed, no constraints
// - { status: 'published' } = allowed with filter
// - false = denied
```

## Usage Patterns

### Generic APIs (ItemsController)

HTTP methods automatically map to actions:

- `GET` → `'read'`
- `POST` → `'create'`
- `PATCH` → `'update'`
- `DELETE` → `'delete'`

```typescript
// In ItemsService
async create(collection: string, data: any) {
  this.permissionService.assert(collection, 'create');
  return this.repository.create(collection, data);
}
```

### Custom APIs

Explicitly declare required actions:

```typescript
// In ReportsService
async getActiveUsers(query: any) {
  // Custom action for report generation
  this.permissionService.assert('reports', 'generate');

  // ... business logic
}
```

### Virtual Scopes

Actions can apply to virtual collections (logical scopes):

```typescript
permissionService.assert('system', 'rebuild_index');
permissionService.assert('analytics', 'view_dashboard');
```

## Implementation in PermissionService

```typescript
can(collection: string, action: string): any {
  const user = this.context.user;

  // Admin bypass
  if (user?.role === 'admin') return {};

  // Custom action logic
  if (action === 'export') {
    return user ? {} : false;
  }

  if (action === 'publish') {
    return user && ['editor', 'admin'].includes(user.role) ? {} : false;
  }

  // Default logic
  return user ? {} : false;
}
```

## Examples

### Export Feature

```typescript
@Get(':collection/export')
async export(@Param('collection') collection: string) {
  this.permissionService.assert(collection, 'export');
  // ... export logic
}
```

### Multi-Action Check

```typescript
async publishPost(id: number) {
  // User must have both read AND publish permissions
  this.permissionService.assert('posts', ['read', 'publish']);
  // ... publish logic
}
```

### Custom Report with Virtual Scope

```typescript
@Get('reports/sales')
async salesReport() {
  this.permissionService.assert('reports', 'view_sales');
  // ... report logic
}
```

## Extension Points

To add new actions, simply:

1. Add logic in `PermissionService.can()` for the new action
2. Use `assert()` or `can()` in your service layer
3. No changes needed to controllers or infrastructure

The system is designed to be **action-agnostic** and **infinitely extensible**.
