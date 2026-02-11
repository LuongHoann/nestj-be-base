This file is a merged representation of the entire codebase, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
.env.example
.gitignore
.prettierrc
audit_log_implementation_notes.md
docs/api-usage.md
docs/custom-api.md
docs/extending-endpoints.md
docs/huong_dan.md
docs/meta-queries.md
docs/meta-query-examples.md
docs/query-dsl.md
docs/RBAC_ACTIONS.md
docs/RBAC.md
eslint.config.mjs
first_ai_commad.md
generate-resource.sh
mikro-orm.config.ts
MOVE_MAIL_API.md
nest-cli.json
package.json
src/app.controller.spec.ts
src/app.controller.ts
src/app.module.ts
src/app.service.ts
src/audit/audit-log.interceptor.ts
src/audit/audit.module.ts
src/audit/audit.service.ts
src/auth/auth.controller.ts
src/auth/auth.module.ts
src/auth/auth.service.ts
src/auth/decorators/current-user.decorator.ts
src/auth/dto/login.dto.ts
src/auth/dto/reset-password.dto.ts
src/auth/guards/exchange-auth.guard.ts
src/auth/guards/jwt-auth.guard.ts
src/auth/strategies/jwt.strategy.ts
src/common/cache/cache.module.ts
src/common/cache/dragonfly.service.ts
src/common/common.module.ts
src/common/context/request.context.ts
src/common/exceptions/invalid-query.exception.ts
src/common/interceptors/request-context.interceptor.ts
src/common/localization/vi.ts
src/config/auth.config.ts
src/config/database.config.ts
src/config/dragonfly.config.ts
src/config/query.config.ts
src/config/storage.config.ts
src/database/entities/audit-log.entity.ts
src/database/entities/file.entity.ts
src/database/entities/user.entity.ts
src/database/migrations/.snapshot-postgres.json
src/database/migrations/Migration20260204095049.ts
src/dto/post/create-post.dto.ts
src/dto/post/update-post.dto.ts
src/exchange/controllers/exchange.controller.ts
src/exchange/dto/exchange.dto.ts
src/exchange/exchange.module.ts
src/exchange/interceptors/exchange-error.interceptor.ts
src/exchange/interfaces/mail-provider.interface.ts
src/exchange/README_DOC.md
src/exchange/README.md
src/exchange/services/exchange-auth.service.ts
src/exchange/services/imap-mail.provider.ts
src/exchange/services/mail.service.ts
src/exchange/utils/json.helper.ts
src/files/dto/commit-file.dto.ts
src/files/dto/temp-upload-response.dto.ts
src/files/files.controller.ts
src/files/files.module.ts
src/files/files.scheduler.ts
src/files/files.service.ts
src/main.ts
src/meta/entity-registry.service.ts
src/meta/meta.module.ts
src/meta/metadata-reader.service.ts
src/storage/local-storage.adapter.ts
src/storage/storage.interface.ts
src/storage/storage.service.ts
storage/temp/01KFQ0PEXVFWHRZ9ZFDM75E8DZ
storage/temp/01KFQ1GENRTN714S1EQM13ZJJ1
storage/uploads/01KFQ3SQA8JEBXYGP6AZNJBNZ8
storage/uploads/f2efddd8-26e6-4ad8-89ae-eef6e40a33b8
test/app.e2e-spec.ts
test/jest-e2e.json
tsconfig.build.json
tsconfig.json
```

# Files

## File: .prettierrc
````
{
  "singleQuote": true,
  "trailingComma": "all"
}
````

## File: audit_log_implementation_notes.md
````markdown
# Audit Log Implementation Notes and Justification

This document explains the rationale behind the approach chosen for integrating `AuditLogService` into the application, specifically addressing the interaction between singleton services and request-scoped contexts in NestJS.

## The Problem: Scope Mismatch between Singleton Service and Request-Scoped Context

When implementing the audit logging feature, the goal was to log user actions (`create`, `update`, `delete`) within the `ItemsService`. The `AuditLogService` requires information about the `User` performing the action. This user information is available in the `RequestContext` (managed by `RequestContextInterceptor`) and is `Scope.REQUEST`, meaning a new instance is created for each incoming HTTP request.

`ItemsService`, by default, is a **singleton** in NestJS. This means only one instance of `ItemsService` is created and reused throughout the application's lifecycle.

A fundamental rule in NestJS dependency injection is that a **singleton service cannot reliably inject a request-scoped provider.** If `ItemsService` were to directly inject `RequestContext`, NestJS would resolve `RequestContext` only once when `ItemsService` is first instantiated (e.g., at application startup). At that time, there is no active HTTP request, so the `RequestContext` would be empty or contain stale data. All subsequent requests processed by this singleton `ItemsService` would then operate with the same, incorrect `RequestContext` instance, leading to inaccurate audit logs (e.g., logging the wrong user or no user at all).

## Why Passing UserContext from the Controller is the Solution

The `ItemsController` (like all controllers) is inherently **request-scoped**. This means for every incoming HTTP request, a new instance of the controller (or at least its methods) is invoked, and it has direct access to the context of *that specific request*.

The solution implemented involves:

1.  **Extracting `UserContext` in the Controller:** The `@CurrentUser()` decorator is used in the `ItemsController`'s `create`, `update`, and `delete` methods to reliably extract the `UserContext` (which correctly originates from `request.user` populated by `JwtStrategy` and `RequestContextInterceptor`) for the current request.

2.  **Passing `UserContext` as a Method Argument to the Service:** The extracted `UserContext` is then explicitly passed as an argument to the corresponding `ItemsService` methods (`itemsService.create(user, collection, data)`).

This approach ensures:

*   **Scope Safety:** The singleton `ItemsService` does not directly inject a request-scoped `RequestContext`. Instead, it receives the *already resolved and request-specific* `UserContext` as a method parameter. This completely avoids the scope mismatch problem.
*   **Explicitness:** The method signatures of `ItemsService` (`async create(user: UserContext, collection: string, data: any)`) clearly indicate that these operations depend on user context. This improves code readability and maintainability.
*   **Testability:** `ItemsService` methods become easier to unit test, as `UserContext` can be directly mocked and passed as an argument, without needing to simulate the entire NestJS request lifecycle.
*   **Handling Anonymous/Public Actions:** If an endpoint does not require authentication (e.g., if `JwtAuthGuard` is not applied or the user is not logged in), the `@CurrentUser()` decorator will provide `null` (or an object indicating no user). This `null` can then be passed to the `AuditLogService`, allowing it to correctly log actions by anonymous users or simply ignore logging if no user is present.
*   **Preserving Singleton Benefits:** `ItemsService` remains a singleton, benefiting from better performance and resource utilization by avoiding re-instantiation for every request.

## Alternatives Considered (and why they were not chosen)

*   **Making `ItemsService` Request-Scoped:** While this would resolve the scope mismatch, it would mean `ItemsService` (and potentially other services that depend on it) would be instantiated for every request, which can have performance implications. It also complicates the overall service architecture by introducing more request-scoped components than necessary.
*   **Using `ModuleRef` to Dynamically Resolve `RequestContext`:** NestJS provides `ModuleRef` which can be used within a singleton service to dynamically resolve request-scoped providers. However, this adds more boilerplate code and complexity (`this.moduleRef.resolve(RequestContext, { strict: false })`) compared to the straightforward method parameter passing. For this specific use case, direct parameter passing is cleaner.

In conclusion, while `JwtStrategy` and `RequestContextInterceptor` correctly prepare the user context, the most robust and idiomatic way for a singleton service to access this request-specific information is to have it explicitly passed down from a request-scoped component like a controller.
````

## File: docs/api-usage.md
````markdown
# API Usage Guide

## Overview

The system automatically exposes REST APIs for all registered entities via the `/items/:collection` endpoint pattern.

## Collection Mapping

The `:collection` parameter maps to the **table name** of your entity:

- `User` entity with `@Entity()` → `/items/user`
- `Post` entity → `/items/post`
- `Comment` entity → `/items/comment`

**Note:** Use the singular, lowercase table name, not the class name.

## Basic Operations

### List Items

```http
GET /items/post
```

### Get Single Item

```http
GET /items/post/123
```

### Create Item

```http
POST /items/post
Content-Type: application/json

{
  "title": "Hello World",
  "content": "...",
  "status": "draft"
}
```

### Update Item

```http
PATCH /items/post/123
Content-Type: application/json

{
  "status": "published"
}
```

### Delete Item

```http
DELETE /items/post/123
```

## Query Parameters

### Filtering

Use `filter` parameter with JSON object:

**Simple equality:**

```http
GET /items/post?filter={"status":"published"}
```

**Operators:**

```http
GET /items/post?filter={"views":{"_gte":100}}
```

Supported operators:

- `_eq`, `_neq` - equals, not equals
- `_gt`, `_gte`, `_lt`, `_lte` - comparisons
- `_in`, `_nin` - in array, not in array
- `_contains` - substring match
- `_starts_with` - prefix match

**Logical operators:**

```http
GET /items/post?filter={"_or":[{"status":"published"},{"status":"archived"}]}
```

**Nested filters (relations):**

```http
GET /items/post?filter={"author":{"name":{"_contains":"john"}}}
```

**Complex example:**

```http
GET /items/post?filter={
  "_and": [
    {"status": {"_eq": "published"}},
    {"_or": [
      {"views": {"_gt": 1000}},
      {"author": {"role": {"_eq": "admin"}}}
    ]}
  ]
}
```

### Field Selection

Control which fields to return:

**All fields:**

```http
GET /items/post?fields=*
```

**Specific fields:**

```http
GET /items/post?fields=id,title,createdAt
```

**Include relation fields:**

```http
GET /items/post?fields=id,title,author.name,author.email
```

**Wildcard in relations:**

```http
GET /items/post?fields=*,author.*,comments.*
```

### Sorting

Use comma-separated field names. Prefix with `-` for descending:

```http
GET /items/post?sort=-createdAt,title
```

**Sort by relation field:**

```http
GET /items/post?sort=author.name
```

### Pagination

**Limit and offset:**

```http
GET /items/post?limit=10&offset=20
```

**Page-based:**

```http
GET /items/post?limit=10&page=3
```

### Deep Relations

Apply filters/sorting to nested relations:

```http
GET /items/post?deep[comments][_filter][status][_eq]=approved
GET /items/post?deep[comments][_sort]=-createdAt
GET /items/post?deep[comments][_limit]=5
```

## Complete Example

```http
GET /items/post?filter={"status":"published"}&fields=id,title,author.name,comments.*&sort=-createdAt&limit=20&deep[comments][_filter][status][_eq]=approved&deep[comments][_limit]=3
```

This query:

1. Filters posts by `status=published`
2. Returns only `id`, `title`, `author.name`, and all comment fields
3. Sorts by `createdAt` descending
4. Limits to 20 posts
5. For each post, includes only approved comments (max 3)

## Permissions & Security

### Collection-Level RBAC

Permissions are enforced at the **collection level**, not field level:

- `GET` requires `read` permission
- `POST` requires `create` permission
- `PATCH` requires `update` permission
- `DELETE` requires `delete` permission

**Row-level filtering** is automatically applied based on your role. For example:

- Anonymous users may only see `status=published` posts
- Regular users may only see their own user record
- Admins see everything

### Field Selection is NOT Permission-Controlled

If you have `read` permission on a collection, you can request **any field** via the `fields` parameter. Field-level permissions are not implemented.

## Common Errors

### 403 Forbidden

```json
{
  "statusCode": 403,
  "message": "Permission denied: read on post"
}
```

**Cause:** You don't have the required permission for this action.

### 400 Bad Request - Invalid Collection

```json
{
  "statusCode": 400,
  "message": "Collection xyz does not exist"
}
```

**Cause:** The collection name doesn't map to any registered entity.

### 400 Bad Request - Invalid Filter

```json
{
  "statusCode": 400,
  "message": "Filter must be valid JSON"
}
```

**Cause:** The `filter` parameter is not valid JSON.

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Item 123 in post not found"
}
```

**Cause:** The item doesn't exist, or you don't have permission to see it (row-level security).

## Tips

1. **URL-encode complex filters** when using them in GET requests
2. **Use POST body** for very complex queries if your client supports it
3. **Request only needed fields** to reduce payload size
4. **Combine filters** with logical operators for complex queries
5. **Test permissions** with different user roles to understand row-level filtering
````

## File: docs/custom-api.md
````markdown
# Building Custom APIs

## When to Create a Custom API

Use custom APIs when:

- You need business logic beyond simple CRUD
- You're combining data from multiple collections
- You need custom permissions (e.g., `generate_report`, `approve`)
- You're creating computed/aggregated views
- The generic `/items/:collection` pattern doesn't fit

**Don't** create custom APIs for:

- Simple filtering or sorting (use query parameters)
- Field selection (use `fields` parameter)
- Standard CRUD operations

## Required Layers

Custom APIs follow the same architecture as generic APIs:

```
Controller (HTTP) → Service (Business Logic) → QueryEngine + Repository (Data)
```

**Never** access the ORM directly from controllers or services.

## Step-by-Step Example

### 1. Create the Controller

```typescript
// src/controllers/reports.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from '../services/reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('active-users')
  async getActiveUsers(@Query() query: any) {
    return this.reportsService.getActiveUsers(query);
  }

  @Get('sales-summary')
  async getSalesSummary(@Query() query: any) {
    return this.reportsService.getSalesSummary(query);
  }
}
```

**Controller responsibilities:**

- Define HTTP routes
- Extract query parameters
- Delegate to service
- **Nothing else**

### 2. Create the Service

```typescript
// src/services/reports.service.ts
import { Injectable } from '@nestjs/common';
import { QueryEngineService } from '../query/query-engine.service';
import { GenericRepository } from '../repository/generic.repository';
import { PermissionService } from '../common/permissions/permission.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly queryEngine: QueryEngineService,
    private readonly repository: GenericRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async getActiveUsers(query: any) {
    // 1. Check custom permission
    this.permissionService.assert('reports', 'generate');

    // 2. Parse user query (supports Directus-style params)
    const options = await this.queryEngine.parseAndCompile({
      collection: 'user',
      query: query,
    });

    // 3. Add custom business logic filter
    options.where = {
      $and: [
        options.where,
        { status: 'active' },
        {
          lastLoginAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      ],
    };

    // 4. Execute via repository
    return this.repository.find('user', options);
  }

  async getSalesSummary(query: any) {
    // Custom permission for sales data
    this.permissionService.assert('reports', ['read', 'view_sales']);

    const options = await this.queryEngine.parseAndCompile({
      collection: 'order',
      query: query,
    });

    // Business logic: only completed orders
    options.where = {
      $and: [options.where, { status: 'completed' }],
    };

    const orders = await this.repository.find('order', options);

    // Compute aggregates
    const total = orders.reduce((sum, order) => sum + order.amount, 0);

    return {
      orders,
      summary: {
        total,
        count: orders.length,
        average: total / orders.length,
      },
    };
  }
}
```

### 3. Register in Module

```typescript
// src/app.module.ts or custom module
@Module({
  imports: [QueryModule, RepositoryModule, CommonModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
```

## Reusing Query Parameters

Your custom API **automatically supports** Directus-style query parameters:

```http
GET /reports/active-users?filter={"role":"admin"}&sort=-lastLoginAt&limit=10
```

The `QueryEngineService` handles:

- Parsing `filter`, `sort`, `fields`, `deep`
- Applying permission filters
- Compiling to MikroORM queries

You just merge your custom logic into `options.where`.

## Permission Patterns

### Single Custom Action

```typescript
this.permissionService.assert('reports', 'generate');
```

### Multiple Required Actions

```typescript
this.permissionService.assert('analytics', ['read', 'export']);
```

### Virtual Scopes

Use logical scope names that don't map to entities:

```typescript
this.permissionService.assert('system', 'rebuild_index');
this.permissionService.assert('admin', 'manage_users');
```

## What You MUST Do

✅ **Inject** `QueryEngineService`, `GenericRepository`, `PermissionService`  
✅ **Call** `permissionService.assert()` with custom action  
✅ **Reuse** `queryEngine.parseAndCompile()` for user queries  
✅ **Execute** queries via `repository.find()` or `repository.count()`  
✅ **Add** custom business logic by merging filters

## What You MUST NOT Do

❌ **Never** inject `MikroORM` or `EntityManager` directly  
❌ **Never** bypass `PermissionService`  
❌ **Never** build queries manually with raw SQL  
❌ **Never** put business logic in controllers  
❌ **Never** access `repository` from controllers

## Advanced: Combining Multiple Collections

```typescript
async getDashboard(query: any) {
  this.permissionService.assert('dashboard', 'view');

  // Query multiple collections
  const userOptions = await this.queryEngine.parseAndCompile({
    collection: 'user',
    query: { filter: { status: 'active' } }
  });

  const postOptions = await this.queryEngine.parseAndCompile({
    collection: 'post',
    query: { filter: { status: 'published' } }
  });

  const [users, posts] = await Promise.all([
    this.repository.find('user', userOptions),
    this.repository.find('post', postOptions)
  ]);

  return {
    stats: {
      activeUsers: users.length,
      publishedPosts: posts.length
    },
    recentUsers: users.slice(0, 5),
    recentPosts: posts.slice(0, 5)
  };
}
```

## Testing Custom APIs

```bash
# Test permission
curl -X GET http://localhost:3000/reports/active-users
# Should return 403 if not authenticated

# Test with query params
curl -X GET "http://localhost:3000/reports/active-users?sort=-lastLoginAt&limit=5"

# Test with filters
curl -X GET "http://localhost:3000/reports/active-users?filter={\"role\":\"admin\"}"
```

## Summary

Custom APIs give you full control while maintaining:

- Consistent architecture
- Permission enforcement
- Query reusability
- Type safety

Follow the pattern: **Controller → Service → QueryEngine/Repository**, and you'll build maintainable, secure APIs.
````

## File: docs/extending-endpoints.md
````markdown
# Extending the Framework

## Adding New Entities

### 1. Create the Entity

```typescript
// src/database/entities/product.entity.ts
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class Product {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property()
  price!: number;

  @Property()
  stock!: number;
}
```

### 2. Register in MikroORM Config

```typescript
// src/database/mikro-orm.config.ts
import { Product } from './entities/product.entity';

export default defineConfig({
  entities: [User, Post, Comment, Product], // Add here
  // ... rest of config
});
```

### 3. That's It

The system automatically:

- Scans the entity on startup
- Maps `product` → `Product` entity
- Exposes `/items/product` endpoints

**No controller code needed.**

## Adding New RBAC Actions

### 1. Define Action Logic in PermissionService

```typescript
// src/common/permissions/permission.service.ts
can(collection: string, action: string): any {
  const user = this.context.user;

  if (user?.role === 'admin') return {};

  // Add your custom action
  if (action === 'approve') {
    return user && user.role === 'moderator' ? {} : false;
  }

  if (action === 'export_csv') {
    return user && ['admin', 'analyst'].includes(user.role) ? {} : false;
  }

  // ... existing logic
}
```

### 2. Use in Custom Endpoints

```typescript
// In your service
async approvePost(id: number) {
  this.permissionService.assert('post', 'approve');
  // ... approval logic
}

async exportData(collection: string, query: any) {
  this.permissionService.assert(collection, 'export_csv');
  // ... export logic
}
```

### 3. Apply to Multiple Endpoints

```typescript
// Reuse the same action across different services
class PostService {
  async approve(id: number) {
    this.permissionService.assert('post', 'approve');
  }
}

class CommentService {
  async approve(id: number) {
    this.permissionService.assert('comment', 'approve');
  }
}
```

## Extending Query Capabilities

### Adding a New Filter Operator

**1. Add to AST definition:**

```typescript
// src/query/ast/query.ast.ts
export type FilterOperator =
  | '_eq'
  | '_neq'
  | '_gt'
  | '_gte'
  | '_lt'
  | '_lte'
  | '_in'
  | '_nin'
  | '_contains'
  | '_starts_with'
  | '_regex' // NEW
  | '_between'; // NEW
```

**2. Add compilation logic:**

```typescript
// src/query/compiler/where.compiler.ts
private compileOperators(ops: any): any {
  const result: any = {};
  for (const op of Object.keys(ops)) {
    const val = ops[op];
    switch (op as FilterOperator) {
      case '_eq': result['$eq'] = val; break;
      // ... existing cases
      case '_regex':
        result['$re'] = val;
        break;
      case '_between':
        result['$gte'] = val[0];
        result['$lte'] = val[1];
        break;
      default: break;
    }
  }
  return result;
}
```

**3. Use it:**

```http
GET /items/post?filter={"title":{"_regex":"^Hello"}}
GET /items/product?filter={"price":{"_between":[10,100]}}
```

### Adding a New Query Parameter

**Example: Add `search` parameter for full-text search**

**1. Update QueryContext:**

```typescript
// src/query/ast/query.ast.ts
export interface ParsedQuery {
  filter: FilterNode;
  sort: SortNode[];
  pagination: PaginationNode;
  fields: string[];
  deep: DeepNode;
  search?: string; // NEW
}
```

**2. Create parser:**

```typescript
// src/query/parser/search.parser.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class SearchParser {
  parse(search: string): string | null {
    return search?.trim() || null;
  }
}
```

**3. Update QueryEngine:**

```typescript
// src/query/query-engine.service.ts
async parseAndCompile(context: QueryContext): Promise<any> {
  const parsed: ParsedQuery = {
    filter: this.filterParser.parse(query.filter) || {},
    sort: this.sortParser.parse(query.sort),
    pagination: this.paginationParser.parse(query),
    fields: this.fieldsParser.parse(query.fields),
    deep: this.deepParser.parse(query.deep),
    search: this.searchParser.parse(query.search), // NEW
  };

  // Apply search to filter
  if (parsed.search) {
    const searchFilter = {
      '$or': [
        { title: { '$like': `%${parsed.search}%` } },
        { content: { '$like': `%${parsed.search}%` } }
      ]
    };

    finalFilter = {
      '$and': [finalFilter, searchFilter]
    };
  }

  // ... rest of compilation
}
```

**4. Register parser:**

```typescript
// src/query/query.module.ts
@Module({
  providers: [
    // ... existing parsers
    SearchParser,
    QueryEngineService
  ],
})
```

**5. Use it:**

```http
GET /items/post?search=nestjs&sort=-createdAt
```

## Extension Boundaries

### ✅ Belongs in QueryEngine

- Parsing query parameters
- Compiling AST to ORM queries
- Applying permission filters
- Validating query structure

### ✅ Belongs in Service

- Business logic
- Custom permission checks
- Combining multiple queries
- Computing aggregates
- Calling external services

### ❌ NEVER in Controller

- Database queries
- Permission checks
- Business logic
- Data transformation
- ORM access

**Controllers are HTTP-only.** They:

- Extract parameters
- Call service methods
- Return responses
- Handle HTTP-specific concerns (headers, status codes)

## Pattern: Feature Flags

Add feature flags to control new functionality:

```typescript
// src/query/query-engine.service.ts
async parseAndCompile(context: QueryContext): Promise<any> {
  const { collection, query } = context;

  // Feature flag for experimental aggregation
  if (query.aggregate && this.isAggregationEnabled(collection)) {
    return this.compileAggregation(query);
  }

  // Standard query compilation
  // ...
}

private isAggregationEnabled(collection: string): boolean {
  // Check config or feature flag service
  return ['post', 'user'].includes(collection);
}
```

## Pattern: Collection-Specific Behavior

Override behavior for specific collections:

```typescript
// src/services/items.service.ts
async findMany(collection: string, query: any) {
  this.validateCollection(collection);

  const options = await this.queryEngine.parseAndCompile({
    collection,
    query,
  });

  // Collection-specific logic
  if (collection === 'post') {
    // Always exclude deleted posts
    options.where = {
      '$and': [options.where, { deletedAt: null }]
    };
  }

  return this.repository.find(collection, options);
}
```

## Pattern: Middleware for Query Transformation

Add hooks to transform queries before execution:

```typescript
// src/query/query-engine.service.ts
async parseAndCompile(context: QueryContext): Promise<any> {
  let parsed = this.parse(context.query);

  // Apply hooks
  parsed = await this.applyHooks('beforeCompile', context.collection, parsed);

  const compiled = this.compile(parsed);

  return compiled;
}

private async applyHooks(hook: string, collection: string, data: any) {
  // Call registered hooks
  // This allows plugins/extensions to modify queries
  return data;
}
```

## Summary

**Extension philosophy:**

1. **Entities** auto-register → zero config
2. **Actions** are strings → infinite extensibility
3. **Query params** are parsed → add new parsers
4. **Business logic** lives in services → never in controllers
5. **Framework code** stays generic → collection-specific logic in services

Follow these patterns and the system scales from 3 entities to 300.
````

## File: docs/meta-queries.md
````markdown
# Meta Query Parameter

## Overview

The `meta` query parameter allows you to request count metadata alongside your data queries.

## Syntax

```http
GET /items/:collection?meta=<value>
```

**Supported values:**

- `filter_count` - Count of records matching current filters (ignores pagination)
- `total_count` - Total count of all records in collection (ignores filters and pagination)
- `*` - Shorthand for both `filter_count` and `total_count`

**Multiple values:**

```http
?meta=filter_count,total_count
```

## Response Format

### Without Meta (Default)

```http
GET /items/post
```

**Response:**

```json
[
  { "id": 1, "title": "Post 1" },
  { "id": 2, "title": "Post 2" }
]
```

### With Meta

```http
GET /items/post?meta=filter_count
```

**Response:**

```json
{
  "data": [
    { "id": 1, "title": "Post 1" },
    { "id": 2, "title": "Post 2" }
  ],
  "meta": {
    "filter_count": 2
  }
}
```

### With All Meta Fields

```http
GET /items/post?meta=*
```

**Response:**

```json
{
  "data": [
    { "id": 1, "title": "Post 1" },
    { "id": 2, "title": "Post 2" }
  ],
  "meta": {
    "filter_count": 2,
    "total_count": 150
  }
}
```

## Examples

### Pagination with Count

```http
GET /items/post?limit=10&offset=20&meta=filter_count,total_count
```

**Response:**

```json
{
  "data": [
    /* 10 posts */
  ],
  "meta": {
    "filter_count": 150,
    "total_count": 150
  }
}
```

This tells you:

- You're viewing 10 posts (from the data array)
- There are 150 total posts matching your filters
- There are 150 total posts in the collection

### Filtered Query with Count

```http
GET /items/post?filter={"status":"published"}&meta=*
```

**Response:**

```json
{
  "data": [
    /* published posts */
  ],
  "meta": {
    "filter_count": 45,
    "total_count": 150
  }
}
```

This tells you:

- 45 posts are published (filter_count)
- 150 total posts exist (total_count)

### Complex Filter with Pagination

```http
GET /items/post?filter={"author":{"role":"admin"}}&limit=5&meta=filter_count
```

**Response:**

```json
{
  "data": [
    /* 5 posts */
  ],
  "meta": {
    "filter_count": 23
  }
}
```

This tells you:

- You're viewing the first 5 posts
- There are 23 total posts by admin authors

## Semantic Differences

### `filter_count`

- **Includes:** All filters (including permission filters)
- **Ignores:** Pagination (`limit`, `offset`)
- **Use case:** "How many records match my search?"

### `total_count`

- **Includes:** Nothing (base entity count)
- **Ignores:** Filters, pagination, sorting
- **Use case:** "How many total records exist?"

## Performance Considerations

**Counts are executed as separate queries:**

- `filter_count` → `SELECT COUNT(*) WHERE <filters>`
- `total_count` → `SELECT COUNT(*)`

**Optimization tips:**

1. Only request counts you need
2. Use `filter_count` for paginated lists
3. Use `total_count` sparingly (can be expensive on large tables)
4. Consider caching `total_count` if it doesn't change frequently

## Error Handling

### Invalid Meta Value

```http
GET /items/post?meta=invalid_value
```

**Response:**

```json
{
  "statusCode": 400,
  "message": "Invalid meta value: \"invalid_value\". Supported values: filter_count, total_count, *"
}
```

### Empty Meta Value

```http
GET /items/post?meta=
```

**Behavior:** Ignored (same as no meta parameter)

## Backward Compatibility

**Queries without `meta` parameter are unchanged:**

```http
GET /items/post
```

Returns array directly (not wrapped in `{ data, meta }`).

**This ensures existing clients continue to work.**

## Use Cases

### Building Paginated Tables

```http
GET /items/post?limit=20&page=1&meta=filter_count
```

Use `filter_count` to calculate total pages:

```javascript
const totalPages = Math.ceil(meta.filter_count / limit);
```

### Search Results

```http
GET /items/post?filter={"title":{"_contains":"nestjs"}}&meta=filter_count
```

Display: "Found 12 results for 'nestjs'"

### Dashboard Statistics

```http
GET /items/user?meta=total_count
GET /items/post?filter={"status":"published"}&meta=filter_count
```

Display:

- Total users: 1,234
- Published posts: 567

### Infinite Scroll

```http
GET /items/post?limit=20&offset=0&meta=filter_count
```

Keep loading until `data.length + offset >= meta.filter_count`
````

## File: docs/meta-query-examples.md
````markdown
# Meta Query Examples

## Test Scenarios

### 1. Basic Count Request

**Request:**

```bash
curl "http://localhost:3000/items/post?meta=filter_count"
```

**Expected Response:**

```json
{
  "data": [
    { "id": 1, "title": "First Post", "status": "published" },
    { "id": 2, "title": "Second Post", "status": "draft" }
  ],
  "meta": {
    "filter_count": 2
  }
}
```

---

### 2. Total Count Only

**Request:**

```bash
curl "http://localhost:3000/items/post?meta=total_count"
```

**Expected Response:**

```json
{
  "data": [
    /* all posts */
  ],
  "meta": {
    "total_count": 150
  }
}
```

---

### 3. Both Counts (Wildcard)

**Request:**

```bash
curl "http://localhost:3000/items/post?meta=*"
```

**Expected Response:**

```json
{
  "data": [
    /* all posts */
  ],
  "meta": {
    "filter_count": 150,
    "total_count": 150
  }
}
```

---

### 4. Filtered Query with Count

**Request:**

```bash
curl "http://localhost:3000/items/post?filter={\"status\":\"published\"}&meta=*"
```

**Expected Response:**

```json
{
  "data": [
    /* published posts only */
  ],
  "meta": {
    "filter_count": 45,
    "total_count": 150
  }
}
```

**Interpretation:**

- 45 posts are published
- 150 total posts exist in database

---

### 5. Pagination with Count

**Request:**

```bash
curl "http://localhost:3000/items/post?limit=10&offset=20&meta=filter_count"
```

**Expected Response:**

```json
{
  "data": [
    /* 10 posts starting from offset 20 */
  ],
  "meta": {
    "filter_count": 150
  }
}
```

**Interpretation:**

- Showing posts 21-30
- 150 total posts available
- Can calculate: 15 pages total (150 / 10)

---

### 6. Complex Filter + Pagination

**Request:**

```bash
curl "http://localhost:3000/items/post?filter={\"author\":{\"role\":\"admin\"}}&limit=5&meta=*"
```

**Expected Response:**

```json
{
  "data": [
    /* 5 posts by admin authors */
  ],
  "meta": {
    "filter_count": 23,
    "total_count": 150
  }
}
```

**Interpretation:**

- Showing first 5 of 23 posts by admins
- 150 total posts in database

---

### 7. No Meta (Backward Compatible)

**Request:**

```bash
curl "http://localhost:3000/items/post"
```

**Expected Response:**

```json
[
  { "id": 1, "title": "First Post" },
  { "id": 2, "title": "Second Post" }
]
```

**Note:** No `meta` wrapper - returns array directly.

---

### 8. Multiple Meta Values (Comma-Separated)

**Request:**

```bash
curl "http://localhost:3000/items/post?meta=filter_count,total_count"
```

**Expected Response:**

```json
{
  "data": [
    /* posts */
  ],
  "meta": {
    "filter_count": 150,
    "total_count": 150
  }
}
```

---

### 9. Error: Invalid Meta Value

**Request:**

```bash
curl "http://localhost:3000/items/post?meta=invalid"
```

**Expected Response:**

```json
{
  "statusCode": 400,
  "message": "Invalid meta value: \"invalid\". Supported values: filter_count, total_count, *"
}
```

---

### 10. Empty Meta (Ignored)

**Request:**

```bash
curl "http://localhost:3000/items/post?meta="
```

**Expected Response:**

```json
[{ "id": 1, "title": "First Post" }]
```

**Note:** Empty meta is ignored, returns array directly.

---

## Frontend Integration Examples

### React Pagination Component

```typescript
const [posts, setPosts] = useState([]);
const [totalCount, setTotalCount] = useState(0);
const [page, setPage] = useState(1);
const limit = 20;

useEffect(() => {
  fetch(
    `/items/post?limit=${limit}&offset=${(page - 1) * limit}&meta=filter_count`,
  )
    .then((res) => res.json())
    .then((response) => {
      setPosts(response.data);
      setTotalCount(response.meta.filter_count);
    });
}, [page]);

const totalPages = Math.ceil(totalCount / limit);
```

### Vue.js Search Results

```vue
<template>
  <div>
    <p>Found {{ meta.filter_count }} of {{ meta.total_count }} posts</p>
    <div v-for="post in data" :key="post.id">
      {{ post.title }}
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      data: [],
      meta: {},
    };
  },
  async mounted() {
    const response = await fetch(
      '/items/post?filter={"status":"published"}&meta=*',
    );
    const result = await response.json();
    this.data = result.data;
    this.meta = result.meta;
  },
};
</script>
```

### Angular Infinite Scroll

```typescript
export class PostListComponent {
  posts: Post[] = [];
  offset = 0;
  limit = 20;
  filterCount = 0;
  hasMore = true;

  async loadMore() {
    const response = await fetch(
      `/items/post?limit=${this.limit}&offset=${this.offset}&meta=filter_count`,
    );
    const result = await response.json();

    this.posts.push(...result.data);
    this.filterCount = result.meta.filter_count;
    this.offset += this.limit;
    this.hasMore = this.posts.length < this.filterCount;
  }
}
```

---

## Performance Testing

### Scenario 1: Small Dataset (100 records)

```bash
# Without meta
curl "http://localhost:3000/items/post"
# Response time: ~50ms

# With filter_count
curl "http://localhost:3000/items/post?meta=filter_count"
# Response time: ~55ms (+5ms for COUNT query)

# With both counts
curl "http://localhost:3000/items/post?meta=*"
# Response time: ~60ms (+10ms for 2 COUNT queries)
```

### Scenario 2: Large Dataset (100,000 records)

```bash
# Without meta
curl "http://localhost:3000/items/post?limit=20"
# Response time: ~50ms

# With filter_count
curl "http://localhost:3000/items/post?limit=20&meta=filter_count"
# Response time: ~80ms (+30ms for COUNT on large table)

# With indexed filter + count
curl "http://localhost:3000/items/post?filter={\"status\":\"published\"}&meta=filter_count"
# Response time: ~70ms (indexed column)
```

**Recommendation:** Only request counts when needed for UI (pagination, search results).
````

## File: docs/query-dsl.md
````markdown
# Query DSL Specification

This document describes the Domain Specific Language (DSL) used for querying the API. The Query Engine allows for advanced filtering, sorting, and pagination.

## Filtering (`filter`)

Pass a JSON object to the `filter` query parameter.

### Examples

**Equality**

```json
{ "status": "active" }
```

**Comparison**

```json
{ "age": { "$gt": 18, "$lte": 65 } }
```

**Logical Operators (AND/OR)**

```json
{
  "$or": [{ "role": "admin" }, { "role": "editor" }]
}
```

**Relation Filtering**

```json
{
  "author": {
    "name": { "$like": "John%" }
  }
}
```

### Supported Operators

- `$eq`: Equal (default)
- `$ne`: Not equal
- `$gt`, `$gte`: Greater than (or equal)
- `$lt`, `$lte`: Less than (or equal)
- `$like`: SQL Like style matching (`%term%`)
- `$in`, `$nin`: In array / Not in array
- `$null`: Is null (true/false)

## Sorting (`sort`)

Pass a JSON object to determine sort order.

### Examples

```json
{ "createdAt": "DESC", "title": "ASC" }
```

## Pagination

- `limit`: Number of items to return (default 10, max configurable)
- `offset` or `page`: Offset or Page number

## Limits & Safety

To ensure system stability, the following limits are enforced by default (can be overridden via Environment Variables):

- **Max Filter Depth:** 3 levels of nested relations.
- **Max Conditions:** 20 conditions per query.
- **Max Sort Fields:** 3 fields.
- **Regex:** Disabled by default for security (`$regex`).

## Not Supported (By Design)

- **Arbitrary Raw SQL:** For security, raw SQL is not allowed.
- **Unlimited Deep Nesting:** Prevents N+1 and performance degradation.
- **Regex ReDoS:** Unsafe regex patterns are blocked if regex is enabled.
````

## File: docs/RBAC_ACTIONS.md
````markdown
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
````

## File: docs/RBAC.md
````markdown
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
````

## File: eslint.config.mjs
````javascript
// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
);
````

## File: first_ai_commad.md
````markdown
Vị trí làm việc : 
 - Bạn là 1 senior backend sử dụng tốt đa dạng ngôn ngữ và nắm vững kiến trúc và quy tắc phát triển phần mềm 
Quy ước làm việc:

- File `repomix-output.md` là TOÀN BỘ source of truth cho dự án này.
- Chỉ sử dụng thông tin có trong file. Không suy đoán, không bổ sung từ kiến thức chung.
- Nếu một module / hành vi không xuất hiện trong file, coi như KHÔNG TỒN TẠI.
- Ưu tiên logic hiện tại; bỏ qua legacy, commented code, TODO.
- Khi thông tin mâu thuẫn, hãy hỏi ý kiến của tôi để quyết định đâu là phần được cập nhật.

Hãy trả lời "OK, đã hiểu" trước khi tôi giao nhiệm vụ tiếp theo.
````

## File: generate-resource.sh
````bash
#!/bin/bash

# generate-resource.sh
# Script này dùng để tự động tạo Controller và DTO cho một resource mới bằng cách đọc file entity.

# Kiểm tra xem có tham số được truyền vào không
if [ -z "$1" ]; then
    echo "Lỗi: Vui lòng cung cấp tên resource."
    echo "Ví dụ: ./generate-resource.sh Product"
    exit 1
fi

# --- Tên Biến ---
# Ví dụ: $1 = "Product"
NAME=$1
PascalCaseName=$NAME
lowerCaseName=$(echo "$NAME" | tr '[:upper:]' '[:lower:]')
# Lưu ý: Việc tạo số nhiều chỉ đơn giản là thêm 's'.

# --- Đường dẫn ---
controllerPath="src/controllers"
dtoPath="src/dto/$lowerCaseName"
entityFilePath="src/database/entities/$lowerCaseName.entity.ts"
controllerFilePath="$controllerPath/$lowerCaseName.controller.ts"
createDtoFilePath="$dtoPath/create-$lowerCaseName.dto.ts"
updateDtoFilePath="$dtoPath/update-$lowerCaseName.dto.ts"

# --- Tạo thư mục nếu chưa tồn tại ---
if [ ! -d "$dtoPath" ]; then
    mkdir -p "$dtoPath"
    echo "Đã tạo thư mục: $dtoPath"
fi

# --- Nội dung file DTO (Create) ---
# Tạo nội dung DTO cơ bản, người dùng sẽ tự điền chi tiết.
createDtoContent=$(cat <<EOF
// import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class Create${PascalCaseName}Dto {
  // Đây là nơi bạn sẽ định nghĩa các thuộc tính cho DTO.
  // Ví dụ:
  //
  // @IsString()
  // @IsNotEmpty()
  // name: string;
  //
  // @IsString()
  // @IsOptional()
  // description?: string;
}
EOF
)

# --- Nội dung file DTO (Update) ---
updateDtoContent=$(cat <<EOF
import { PartialType } from '@nestjs/mapped-types';
import { Create${PascalCaseName}Dto } from './create-${lowerCaseName}.dto';

export class Update${PascalCaseName}Dto extends PartialType(Create${PascalCaseName}Dto) {}
EOF
)

# --- Nội dung file Controller ---
controllerContent=$(cat <<EOF
import { Controller, Post, Body, Patch, Param } from '@nestjs/common';
import { ItemsService } from '../services/items.service';
import { Create${PascalCaseName}Dto } from '../dto/${lowerCaseName}/create-${lowerCaseName}.dto';
import { Update${PascalCaseName}Dto } from '../dto/${lowerCaseName}/update-${lowerCaseName}.dto';

@Controller('items/${lowerCaseName}')
export class ${PascalCaseName}sController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  create(@Body() createDto: Create${PascalCaseName}Dto) {
    // ValidationPipe sẽ tự động chạy trên createDto.
    return this.itemsService.create('${lowerCaseName}', createDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: Update${PascalCaseName}Dto) {
    return this.itemsService.update('${lowerCaseName}', id, updateDto);
  }

  // Ghi chú: Các phương thức GET và DELETE vẫn được ItemsController chung xử lý.
  // Bạn chỉ định nghĩa lại ở đây khi cần logic đặc biệt cho việc đọc hoặc xóa.
}
EOF
)

# --- Ghi file ---
echo "$createDtoContent" > "$createDtoFilePath"
echo "Đã tạo file DTO (Create): $createDtoFilePath"

echo "$updateDtoContent" > "$updateDtoFilePath"
echo "Đã tạo file DTO (Update): $updateDtoFilePath"

echo "$controllerContent" > "$controllerFilePath"
echo "Đã tạo file Controller: $controllerFilePath"

echo -e "\n\033[0;32mHoàn thành! Script đã ánh xạ các thuộc tính từ entity. Hãy kiểm tra lại file DTO và đăng ký Controller mới trong module của bạn.\033[0m"

exit 0
````

## File: MOVE_MAIL_API.md
````markdown
# Move Mail API Documentation

## Endpoint

```
POST /webmail/mail/move
```

## Description

Di chuyển email từ folder này sang folder khác sử dụng IMAP MOVE command native.

## Authentication

Yêu cầu `ExchangeAuthGuard` - cần có session token hợp lệ trong cookie hoặc Authorization header.

## Request Body

```typescript
{
  "messageId": string,    // ID của email cần di chuyển (base64 encoded: folder:uid)
  "targetFolder": string  // Folder đích (có thể dùng tên ngắn hoặc tên đầy đủ)
}
```

### Supported Target Folders

Bạn có thể sử dụng tên ngắn (sẽ được map tự động):

- `inbox` → `INBOX`
- `sent` → `Sent Items`
- `drafts` → `Drafts`
- `trash` → `Deleted Items`
- `spam` → `Spam`

Hoặc sử dụng tên folder đầy đủ trực tiếp (ví dụ: `Sent Items`, `Drafts`, etc.)

## Example Requests

### 1. Di chuyển email từ Inbox sang Trash

```bash
curl -X POST http://localhost:3000/webmail/mail/move \
  -H "Content-Type: application/json" \
  -H "Cookie: exchange_session=YOUR_SESSION_TOKEN" \
  -d '{
    "messageId": "SU5CT1g6MTIzNDU=",
    "targetFolder": "trash"
  }'
```

### 2. Di chuyển email từ Inbox sang Drafts

```bash
curl -X POST http://localhost:3000/webmail/mail/move \
  -H "Content-Type: application/json" \
  -H "Cookie: exchange_session=YOUR_SESSION_TOKEN" \
  -d '{
    "messageId": "SU5CT1g6MTIzNDU=",
    "targetFolder": "drafts"
  }'
```

### 3. Di chuyển email sang folder với tên đầy đủ

```bash
curl -X POST http://localhost:3000/webmail/mail/move \
  -H "Content-Type: application/json" \
  -H "Cookie: exchange_session=YOUR_SESSION_TOKEN" \
  -d '{
    "messageId": "SU5CT1g6MTIzNDU=",
    "targetFolder": "Sent Items"
  }'
```

## Response

### Success Response

```json
{
  "success": true
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "Error message here",
  "error": "Bad Request"
}
```

## Implementation Details

### Backend Flow

1. **Controller** (`exchange.controller.ts`):
   - Nhận request với `MoveMailDto`
   - Validate dữ liệu đầu vào
   - Gọi `mailService.moveMessage()`

2. **Service** (`mail.service.ts`):
   - Map folder type sang folder ID thực tế
   - Gọi provider với connection management (`withProvider`)

3. **Provider** (`imap-mail.provider.ts`):
   - Decode messageId để lấy source folder và UID
   - Sử dụng `client.messageMove()` với native IMAP MOVE command
   - Lock source folder trong quá trình di chuyển
   - Log kết quả

### Technical Notes

- Sử dụng **native IMAP MOVE command** (RFC 6851) - hiệu quả hơn COPY + DELETE
- Tự động lock mailbox trong quá trình di chuyển để tránh race conditions
- Message ID được encode dưới dạng base64: `folder:uid`
- Hỗ trợ đầy đủ error handling và logging

## Validation Rules

- `messageId`: Bắt buộc, phải là string không rỗng
- `targetFolder`: Bắt buộc, phải là string không rỗng

## Error Cases

- Message không tồn tại
- Folder đích không tồn tại
- Không có quyền truy cập folder
- Session hết hạn hoặc không hợp lệ
- IMAP connection error
````

## File: nest-cli.json
````json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
````

## File: src/app.controller.spec.ts
````typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
````

## File: src/app.controller.ts
````typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
````

## File: src/app.service.ts
````typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
````

## File: src/audit/audit.module.ts
````typescript
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLog } from '../database/entities/audit-log.entity';
import { AuditLogService } from './audit.service';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([AuditLog]),
    CommonModule,
  ],
  providers: [
    AuditLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [AuditLogService],
})
export class AuditLogModule {}
````

## File: src/auth/decorators/current-user.decorator.ts
````typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
````

## File: src/auth/dto/login.dto.ts
````typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
````

## File: src/auth/dto/reset-password.dto.ts
````typescript
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
````

## File: src/auth/guards/exchange-auth.guard.ts
````typescript
// guards/exchange-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ExchangeAuthService } from '../../exchange/services/exchange-auth.service';

@Injectable()
export class ExchangeAuthGuard implements CanActivate {
  constructor(private readonly authService: ExchangeAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionToken = request.cookies?.['exchange_session'];

    if (!sessionToken) {
      throw new UnauthorizedException('No session token provided');
    }

    const isValid = await this.authService.validateSession(sessionToken);
    
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Refresh session on each request
    await this.authService.refreshSession(sessionToken);
    
    // Attach session token to request
    request['exchangeSession'] = sessionToken;
    
    return true;
  }
}
````

## File: src/common/cache/cache.module.ts
````typescript
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import dragonflyConfig from '../../config/dragonfly.config';
import { DragonflyService } from './dragonfly.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(dragonflyConfig)],
  providers: [DragonflyService],
  exports: [DragonflyService],
})
export class CacheModule {}
````

## File: src/common/exceptions/invalid-query.exception.ts
````typescript
import { BadRequestException } from '@nestjs/common';

export class InvalidQueryException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}
````

## File: src/common/interceptors/request-context.interceptor.ts
````typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Scope,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContext } from '../context/request.context';

@Injectable({ scope: Scope.REQUEST })
export class RequestContextInterceptor implements NestInterceptor {
  constructor(@Inject(RequestContext) private readonly requestContext: RequestContext) {
    console.log('🏗️ RequestContextInterceptor created, requestContext:', !!this.requestContext);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // ✅ Sau khi JwtStrategy validate, gắn user từ request.user vào RequestContext
    if (request.user) {
      this.requestContext.user = request.user;
    }

    return next.handle();
  }
}
````

## File: src/common/localization/vi.ts
````typescript
export const collectionTranslations: Record<string, string> = {
  posts: 'Bài viết',
  users: 'Người dùng',
  comments: 'Bình luận',
  roles: 'Vai trò',
  permissions: 'Quyền',
  files: 'Tệp tin',
  reports: 'Báo cáo',
  items: 'Dữ liệu',
};

export const actionTranslations: Record<string, string> = {
  read: 'Xem',
  create: 'Tạo mới',
  update: 'Cập nhật',
  delete: 'Xóa',
  publish: 'Xuất bản',
  generate: 'Tạo',
  export_pdf: 'Xuất file PDF',
  view_sales: 'Xem doanh số',
  manage_users: 'Quản lý người dùng',
};
````

## File: src/config/dragonfly.config.ts
````typescript
import { registerAs } from '@nestjs/config';

export default registerAs('dragonfly', () => ({
  enabled: process.env.DRAGONFLY_ENABLED === 'true' || false,
  host: process.env.DRAGONFLY_HOST || 'localhost',
  port: parseInt(process.env.DRAGONFLY_PORT || '6379', 10),
  password: process.env.DRAGONFLY_PASSWORD || '',
  ttl: parseInt(process.env.DRAGONFLY_TTL || '300', 10), // Default 5 minutes
}));
````

## File: src/config/query.config.ts
````typescript
import { registerAs } from '@nestjs/config';

export default registerAs('query', () => ({
  maxDepth: parseInt(process.env.QUERY_MAX_DEPTH || '3', 10),
  maxConditions: parseInt(process.env.QUERY_MAX_CONDITIONS || '20', 10),
  maxSortFields: parseInt(process.env.QUERY_MAX_SORT_FIELDS || '3', 10),
  allowRegex: process.env.QUERY_ALLOW_REGEX === 'true',
}));
````

## File: src/config/storage.config.ts
````typescript
import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  driver: process.env.STORAGE_DRIVER || 'local',
  path: process.env.FILE_STORAGE_PATH || './storage',
}));
````

## File: src/database/entities/audit-log.entity.ts
````typescript
import { Entity, PrimaryKey, Property, ManyToOne, Index } from '@mikro-orm/core';
import { User } from './user.entity';

@Entity({ tableName: 'audit_logs' })
@Index({ properties: ['collection', 'targetId'] })
export class AuditLog {
  @PrimaryKey({ type: 'bigint' })
  id!: string;

  @ManyToOne(() => User, { nullable: true, index: 'audit_log_user_id_index' })
  user?: User;

  @Property({ length: 100, index: 'audit_log_collection_index' })
  collection!: string;

  @Property({ length: 50 })
  action!: string;

  @Property({ length: 255, index: 'audit_log_target_id_index' })
  targetId!: string;

  @Property({ type: 'json', nullable: true })
  details?: Record<string, any>;

  @Property({ onCreate: () => new Date() })
  timestamp = new Date();
}
````

## File: src/database/entities/file.entity.ts
````typescript
import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  Index,
} from '@mikro-orm/core';

/**
 * File status enum for tracking lifecycle
 * TEMP - Temporary upload, not yet committed
 * ACTIVE - Committed and available
 * DELETED - Soft-deleted (for cleanup)
 */
export enum FileStatus {
  TEMP = 'TEMP',
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
}

/**
 * File entity for managing uploaded files
 * Uses ULID as primary key for globally unique, sortable IDs
 */
@Entity({ tableName: 'files'})
export class File {
  /**
   * Primary key using PostgreSQL UUID
   * Auto-generated by database using gen_random_uuid()
   */
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  /**
   * Original filename from user upload
   */
  @Property()
  originalName!: string;

  /**
   * Stored filename on filesystem (typically same as ID)
   */
  @Property()
  storedName!: string;

  /**
   * MIME type of the file (e.g., 'image/jpeg', 'application/pdf')
   */
  @Property()
  mimeType!: string;

  /**
   * File size in bytes
   * Using bigint to support large files (though enforced max is 100MB)
   */
  @Property({ type: 'bigint' })
  size!: bigint;

  /**
   * Relative storage path from storage root
   * e.g., 'temp/{id}' or 'uploads/{id}'
   */
  @Property()
  storagePath!: string;

  /**
   * File lifecycle status
   * Indexed for efficient cleanup queries
   */
  @Enum(() => FileStatus)
  @Index()
  status: FileStatus = FileStatus.TEMP;

  /**
   * Optional custom metadata as JSON
   * Can store user-provided tags, descriptions, etc.
   */
  @Property({ type: 'jsonb', nullable: true })
  customMetadata?: Record<string, any>;

  /**
   * Timestamp when file was created
   */
  @Property()
  createdAt: Date = new Date();

  /**
   * Timestamp when file was last updated
   */
  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
````

## File: src/database/migrations/Migration20260204095049.ts
````typescript
import { Migration } from '@mikro-orm/migrations';

export class Migration20260204095049 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "roles_permissions" drop constraint "roles_permissions_permission_id_foreign";`);

    this.addSql(`alter table "roles_permissions" drop constraint "roles_permissions_role_id_foreign";`);

    this.addSql(`create table "users" ("id" varchar(255) not null, "email" varchar(255) not null, "is_active" boolean not null default true, "mailbox_initialized" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "users_pkey" primary key ("id"));`);
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);

    this.addSql(`create table "audit_logs" ("id" bigserial primary key, "user_id" varchar(255) null, "collection" varchar(100) not null, "action" varchar(50) not null, "target_id" varchar(255) not null, "details" jsonb null, "timestamp" timestamptz not null);`);
    this.addSql(`create index "audit_log_user_id_index" on "audit_logs" ("user_id");`);
    this.addSql(`create index "audit_log_collection_index" on "audit_logs" ("collection");`);
    this.addSql(`create index "audit_log_target_id_index" on "audit_logs" ("target_id");`);
    this.addSql(`create index "audit_logs_collection_target_id_index" on "audit_logs" ("collection", "target_id");`);

    this.addSql(`alter table "audit_logs" add constraint "audit_logs_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`drop table if exists "permissions" cascade;`);

    this.addSql(`drop table if exists "roles" cascade;`);

    this.addSql(`drop table if exists "roles_permissions" cascade;`);

    this.addSql(`alter table "files" alter column "id" drop default;`);
    this.addSql(`alter table "files" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "files" alter column "id" set default gen_random_uuid();`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "audit_logs" drop constraint "audit_logs_user_id_foreign";`);

    this.addSql(`create table "permissions" ("id" serial primary key, "collection" varchar(255) not null, "action" varchar(255) not null, "description" varchar(255) null);`);
    this.addSql(`create index "permissions_collection_action_index" on "permissions" ("collection", "action");`);

    this.addSql(`create table "roles" ("id" serial primary key, "name" varchar(255) not null, "description" varchar(255) null);`);
    this.addSql(`alter table "roles" add constraint "roles_name_unique" unique ("name");`);

    this.addSql(`create table "roles_permissions" ("role_id" int4 not null, "permission_id" int4 not null, constraint "roles_permissions_pkey" primary key ("role_id", "permission_id"));`);

    this.addSql(`alter table "roles_permissions" add constraint "roles_permissions_permission_id_foreign" foreign key ("permission_id") references "permissions" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "roles_permissions" add constraint "roles_permissions_role_id_foreign" foreign key ("role_id") references "roles" ("id") on update cascade on delete cascade;`);

    this.addSql(`drop table if exists "users" cascade;`);

    this.addSql(`drop table if exists "audit_logs" cascade;`);

    this.addSql(`alter table "files" alter column "id" drop default;`);
    this.addSql(`alter table "files" alter column "id" drop default;`);
    this.addSql(`alter table "files" alter column "id" type uuid using ("id"::text::uuid);`);
  }

}
````

## File: src/dto/post/create-post.dto.ts
````typescript
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDefined } from 'class-validator';

export class CreatePostDto {
  @IsDefined({message: "Tiêu đề không được để trống"})
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @IsString({message: "Tiêu đề phải là chuỗi"})
  title: string;
  
  @IsString({message: "Nội dung phải là chuỗi"})
  @IsOptional()
  content?: string;

  @IsNotEmpty({message: "Tác giả không được để trống"})
  author: number;
}
````

## File: src/dto/post/update-post.dto.ts
````typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(CreatePostDto) {}
````

## File: src/exchange/interceptors/exchange-error.interceptor.ts
````typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ExchangeErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError(err => {
        // Map EWS errors to HTTP Status
        // err.name or err.message often contains the code
        const msg = err.message || '';
        
        if (msg.includes('ErrorInvalidCredentials') || msg.includes('401')) {
            return throwError(() => new HttpException('Sai thông tin đăng nhập Exchange', 401));
        }
        if (msg.includes('AccountIsLocked') || msg.includes('ErrorImpersonationDenied')) {
            return throwError(() => new HttpException('Tài khoản bị khóa hoặc không có quyền truy cập', 403));
        }
        if (msg.includes('ErrorServerBusy')) {
            return throwError(() => new HttpException('Máy chủ đang bận, vui lòng thử lại sau', 429));
        }
         if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
            return throwError(() => new HttpException('Mất kết nối đến Exchange Server', 504));
        }

        // Default
        Logger.error(`EWS Error: ${msg}`, err.stack);
        return throwError(() => new HttpException('Lỗi kết nối Exchange Webmail', 500));
      }),
    );
  }
}
````

## File: src/exchange/README_DOC.md
````markdown
# Tài liệu Module Exchange Webmail (Cập nhật: Refresh Token Flow)

Tài liệu này cung cấp cái nhìn tổng quan về luồng hoạt động (Flow) và hướng dẫn sử dụng API (Implementation) của module Exchange Webmail, phục vụ cho Frontend Developers và Testers.

---

## 1. Luồng hoạt động (Flow Doc)

Hệ thống hoạt động theo mô hình **Stateless Session** kết hợp cơ chế **Split-Token Refresh**, tương tự như module Auth chính của hệ thống.

### A. Luồng Đăng nhập (Login Flow)

**Thông tin gửi đi (Request):**

- **Endpoint**: `POST /webmail/auth/login`
- **Địa điểm gửi**: **Body (JSON)**
- **Nội dung**:
  ```json
  {
    "email": "user@domain.com",
    "password": "your_password"
  }
  ```

**Thông tin nhận về (Response):**

- **Tại Body (JSON)**: Trả về bộ đôi token mới nhất.
  ```json
  {
    "success": true,
    "accessToken": "ULID_SESSION_TOKEN",
    "refreshToken": "TOKEN_ID.TOKEN_SECRET"
  }
  ```
- **Tại Cookie (Browser Store)**: Tự động lưu vào Cookie có tên `exchange_session`. Cookie này chứa giá trị của `accessToken`.

---

### B. Luồng Làm mới Token (Refresh Flow)

**Thông tin gửi đi (Request):**

- **Endpoint**: `POST /webmail/auth/refresh`
- **Địa điểm gửi**: **Body (JSON)**
- **Nội dung**:
  ```json
  {
    "refreshToken": "TOKEN_ID.TOKEN_SECRET"
  }
  ```

**Thông tin nhận về (Response):**

- **Tại Body (JSON)**: Trả về bộ đôi token MỚI (Token cũ sẽ bị hủy ngay lập tức).
  ```json
  {
    "accessToken": "NEW_ULID_SESSION_TOKEN",
    "refreshToken": "NEW_TOKEN_ID.TOKEN_SECRET"
  }
  ```
- **Tại Cookie (Browser Store)**: Cập nhật lại giá trị mới của `accessToken` vào Cookie `exchange_session`.

---

### C. Cách sử dụng Token cho các API khác (Folders, Mail List, Send...)

Hệ thống hỗ trợ 2 cách để xác thực các yêu cầu tiếp theo:

1. **Cookie (Tự động)**: Browser sẽ tự gửi kèm Cookie `exchange_session`.
2. **Access Token**: Nếu không dùng Browser, các công cụ khác có thể gửi `accessToken` trong Header hoặc tùy biến theo Guard. (Hiện tại Guard ưu tiên nhận từ Cookie).

---

### D. Luồng Đăng xuất (Logout Flow)

**Thông tin gửi đi (Request):**

- **Endpoint**: `POST /webmail/auth/logout`
- **Địa điểm gửi**: **Body (JSON)**
- **Nội dung (Khuyên dùng)**:
  ```json
  {
    "refreshToken": "TOKEN_ID.TOKEN_SECRET"
  }
  ```
  **Kết quả**:
- Cookie `exchange_session` bị xóa ở browser.
- Access Token và Refresh Token tương ứng bị xóa khỏi Redis.

---

## 2. Hướng dẫn sử dụng API (Implements Doc)

**Base URL**: `/webmail`

### A. Xác thực (Authentication)

#### 1. Đăng nhập

- **Endpoint**: `POST /auth/login`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "accessToken": "...",
    "refreshToken": "..."
  }
  ```
- **Lưu ý**: Server cũng tự động set cookie `exchange_session` chứa `accessToken`.

#### 2. Làm mới Token

- **Endpoint**: `POST /auth/refresh`
- **Body**:
  ```json
  {
    "refreshToken": "token_id.token_secret"
  }
  ```
- **Response**: Trả về bộ token mới.

#### 3. Đăng xuất

- **Endpoint**: `POST /auth/logout`
- **Body** (Khuyên dùng):
  ```json
  {
    "refreshToken": "..."
  }
  ```
- **Mô tả**: Xóa session (Access Token) và thu hồi Refresh Token trong Redis.

---

### B. Quản lý Mail (Mail Management)

#### 1. Lấy danh sách thư mục (Folders)

- **Endpoint**: `GET /folders`
- **Response**:
  ```json
  [
    { "id": "INBOX", "name": "Hộp thư đến" },
    ...
  ]
  ```

#### 2. Lấy danh sách email

- **Endpoint**: `GET /mail`
- **Query Params**: `folder`, `page`, `pageSize`.
- **Lưu ý về ID**: ID trả về là chuỗi Base64 (ví dụ: `SU5CT1g6MTIzNDU=`). Dùng ID này cho các API chi tiết.

#### 3. Xem chi tiết email

- **Endpoint**: `GET /mail/:id`
- **Tác động**: Đánh dấu thư là **Đã đọc** trên server.

#### 4. Gửi email

- **Endpoint**: `POST /mail/send`
- **Body**: `to`, `cc`, `subject`, `htmlBody`.

---

## 3. Lưu ý cho Testers & Frontend

1. **Token Rotation**: Refresh Token chỉ sử dụng được **MỘT LẦN**. Ngay khi gọi `/refresh`, token cũ sẽ bị hủy.
2. **TTL**: Access Token hết hạn sau 1 giờ. Refresh Token hết hạn sau 7 ngày.
3. **Security**: Thông tin đăng nhập Exchange được mã hóa cực kỳ an toàn trong Redis, không bao giờ lưu dưới dạng plaintext.
````

## File: src/exchange/README.md
````markdown
# Exchange Webmail MVP Module

This module provides a backend-only integration with Microsoft Exchange Web Services (EWS) via `ews-javascript-api`.

## ⚠️ MVP ONLY WARNING

**This implementation is an MVP (Minimum Viable Product).**

1.  **Direct Credentials**: It uses direct Username/Password authentication against Exchange.
    - Credentials are encrypted using **AES-256-GCM**.
    - Key is derived using **Argon2** from a dedicated secret + user salt.
    - Stored temporarily in Redis with a 30-minute TTL.
    - **MUST** be replaced by OAuth / Modern Auth before production hardening.

2.  **No Attachments**: Attachments are out of scope.
3.  **Strict Folder Mapping**: Only supports `Inbox`, `SentItems`, `Drafts`, `DeletedItems` via `WellKnownFolderName`.

## Configuration

Ensure these environment variables are set:

```env
EXCHANGE_CRED_SECRET=complex_secret_string_for_argon2
EWS_URL=https://outlook.office365.com/EWS/Exchange.asmx
```

(See `.env.example` for details)

## Architecture

- `ExchangeAuthService`: Handles login, key derivation, encryption/decryption.
- `ExchangeClientFactory`: Creates request-scoped `ExchangeService` instances using cached credentials.
- `MailService`: Business logic for folders, listing, reading, sending.
- `ExchangeController`: Exposes REST endpoints (`/webmail/...`).

## Endpoints

- `POST /webmail/auth/login`: Login to Exchange context (requires App Auth).
- `POST /webmail/auth/logout`: Clear Exchange context.
- `GET /webmail/folders`: List supported folders.
- `GET /webmail/mail?folder=inbox&page=1`: List emails.
- `GET /webmail/mail/:id`: Read email body.
- `POST /webmail/mail/send`: Send email.
- `GET /webmail/mail/search?q=...`: Search inbox.
````

## File: src/exchange/utils/json.helper.ts
````typescript
/**
 * Safely stringify objects that may contain BigInt values
 * @param obj - The object to stringify
 * @returns JSON string with BigInt values converted to strings
 */
export function safeStringify(obj: any): string {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}
````

## File: src/files/dto/commit-file.dto.ts
````typescript
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CommitFileDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  originalName?: string;

  @IsOptional()
  @IsObject()
  extraMetadata?: Record<string, any>;
}
````

## File: src/files/dto/temp-upload-response.dto.ts
````typescript
export class TempUploadResponseDto {
  id!: string;
  originalName!: string;
  mimeType!: string;
  size!: number;
  previewUrl!: string;

  constructor(partial: Partial<TempUploadResponseDto>) {
    Object.assign(this, partial);
  }
}
````

## File: src/files/files.controller.ts
````typescript
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  Res,
  Query,
  BadRequestException,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { CommitFileDto } from './dto/commit-file.dto';
import { TempUploadResponseDto } from './dto/temp-upload-response.dto';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * POST /files/upload
   * Upload file to temporary storage
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTemp(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<TempUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.filesService.uploadTemp(file);
  }

  /**
   * GET /files/temp/:id/preview
   * Stream temporary file for preview
   */
  @Get('temp/:id/preview')
  async previewTemp(@Param('id') id: string, @Res() res: Response) {
    const fileMetadata = await this.filesService.getMetadata(id);
    const stream = await this.filesService.getTempFileStream(id);

    // Set headers for inline preview with full info for Postman
    res.setHeader('Content-Type', fileMetadata.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileMetadata.originalName}"`,
    );
    res.setHeader('Content-Length', fileMetadata.size.toString());
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache for temp preview
    res.setHeader('Accept-Ranges', 'bytes');

    stream.pipe(res);
  }

  /**
   * POST /files/commit
   * Commit file from temp to permanent storage
   */
  @Post('commit')
  async commitFile(@Body() dto: CommitFileDto) {
    return this.filesService.commitFile(dto.id, dto.extraMetadata, dto.originalName);
  }

  /**
   * GET /files/:id
   * Get file metadata only (no streaming)
   */
  @Get(':id')
  async getFileMetadata(@Param('id') id: string) {
    const file = await this.filesService.getMetadata(id);

    // Convert bigint to string for JSON serialization
    return {
      ...file,
      size: file.size.toString(),
    };
  }
}

@Controller('assets')
export class AssetsController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * GET /assets/:id
   * Stream permanent file with Range support
   */
  @Get(':id')
  async streamAsset(
    @Param('id') id: string,
    @Query('download') download: string,
    @Res() res: Response,
  ) {
    const { file, stream } = await this.filesService.getFileStream(id);

    // Set Content-Disposition based on download parameter
    const disposition = download === 'true' ? 'attachment' : 'inline';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${file.originalName}"`,
    );

    // Set Content-Type
    res.setHeader('Content-Type', file.mimeType);

    // Set Content-Length
    res.setHeader('Content-Length', file.size.toString());

    // Set Cache-Control as requested
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache

    // Enable Range requests
    res.setHeader('Accept-Ranges', 'bytes');

    // For now, stream entire file (Range handling can be added here)
    stream.pipe(res);
  }
}
````

## File: src/files/files.module.ts
````typescript
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ScheduleModule } from '@nestjs/schedule';
import { File } from '../database/entities/file.entity';
import { FilesController, AssetsController } from './files.controller';
import { FilesService } from './files.service';
import { FilesScheduler } from './files.scheduler';
import { StorageService } from '../storage/storage.service';
import { LocalStorageAdapter } from '../storage/local-storage.adapter';

@Module({
  imports: [MikroOrmModule.forFeature([File]), ScheduleModule.forRoot()],
  controllers: [FilesController, AssetsController],
  providers: [FilesService, FilesScheduler, StorageService, LocalStorageAdapter],
  exports: [FilesService],
})
export class FilesModule {}
````

## File: src/files/files.scheduler.ts
````typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilesService } from './files.service';

/**
 * Scheduled task for cleanup of old temporary files
 * Runs every 5 days
 */
@Injectable()
export class FilesScheduler {
  private readonly logger = new Logger(FilesScheduler.name);

  constructor(private readonly filesService: FilesService) {}

  /**
   * Delete temp files older than 5 days
   * Runs every 5 days at midnight
   */
  @Cron('0 0 */5 * *', {
    name: 'cleanup-temp-files',
    timeZone: 'UTC',
  })
  async handleTempFileCleanup() {
    this.logger.log('Starting temp file cleanup task');

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    try {
      const deletedCount =
        await this.filesService.cleanupTempFiles(fiveDaysAgo);
      this.logger.log(`Deleted ${deletedCount} old temp files`);
    } catch (error) {
      this.logger.error('Error during temp file cleanup:', error);
    }
  }
}
````

## File: src/files/files.service.ts
````typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { File, FileStatus } from '../database/entities/file.entity';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { TempUploadResponseDto } from './dto/temp-upload-response.dto';
import { ReadStream } from 'fs';

@Injectable()
export class FilesService {
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: EntityRepository<File>,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    // Default 100MB = 104857600 bytes
    this.maxFileSize =
      this.configService.get<number>('FILE_MAX_SIZE') || 104857600;

    const allowedTypes = this.configService.get<string>('FILE_ALLOWED_TYPES');
    this.allowedMimeTypes = allowedTypes
      ? allowedTypes.split(',')
      : [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'text/plain',
        ];
  }

  /**
   * Upload file to temporary storage
   * Creates temp database record for tracking
   */
  async uploadTemp(file: Express.Multer.File): Promise<TempUploadResponseDto> {
    // Validate file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`,
      );
    }

    // Validate MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    // Create temp database record (id will be auto-generated by database)
    const tempFile = this.fileRepository.create({
      originalName: file.originalname,
      storedName: '', // Will be updated after we get the id
      mimeType: file.mimetype,
      size: BigInt(file.size),
      storagePath: '', // Will be updated after we get the id
      status: FileStatus.TEMP,
      customMetadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.fileRepository.getEntityManager().persistAndFlush(tempFile);

    // Now we have the auto-generated id, save file to storage
    const storageResult = await this.storageService.saveTemp(file, tempFile.id);

    // Update the record with storage info
    tempFile.storedName = storageResult.storedName;
    tempFile.storagePath = storageResult.storagePath;
    await this.fileRepository.getEntityManager().flush();

    return new TempUploadResponseDto({
      id: tempFile.id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      previewUrl: `/files/temp/${tempFile.id}/preview`,
    });
  }

  /**
   * Commit file from temp to permanent storage
   * Updates database record status
   */
  async commitFile(
    id: string,
    extraMetadata?: Record<string, any>,
    originalName?: string,
  ): Promise<File> {
    // Find existing temp file
    const tempFile = await this.fileRepository.findOne({ 
      id,
      status: FileStatus.TEMP 
    });
    
    if (!tempFile) {
      throw new NotFoundException('Temporary file not found or already committed');
    }

    const tempPath = `temp/${id}`;
    const permanentPath = `uploads/${id}`;

    // Verify temp file exists in storage
    const exists = await this.storageService.exists(tempPath);
    if (!exists) {
      throw new NotFoundException('Temporary file not found in storage');
    }

    // Move to permanent storage
    await this.storageService.moveToPermanent(tempPath, permanentPath);

    // Update record to active status
    tempFile.storagePath = permanentPath;
    tempFile.status = FileStatus.ACTIVE;
    if (originalName) {
      tempFile.originalName = originalName;
    }
    tempFile.customMetadata = extraMetadata || tempFile.customMetadata;
    tempFile.updatedAt = new Date();

    await this.fileRepository.getEntityManager().persistAndFlush(tempFile);

    return tempFile;
  }

  /**
   * Get file metadata from database
   */
  async getMetadata(id: string): Promise<File> {
    const file = await this.fileRepository.findOne({ id });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  /**
   * Get file stream for downloading/previewing
   */
  async getFileStream(id: string): Promise<{ file: File; stream: ReadStream }> {
    const file = await this.getMetadata(id);

    const stream = await this.storageService.getStream(file.storagePath);

    return { file, stream };
  }

  /**
   * Get temp file stream for preview
   */
  async getTempFileStream(id: string): Promise<ReadStream> {
    const tempPath = `temp/${id}`;

    const exists = await this.storageService.exists(tempPath);
    if (!exists) {
      throw new NotFoundException('Temporary file not found');
    }

    return this.storageService.getStream(tempPath);
  }

  /**
   * Cleanup old temporary files
   * Called by scheduled task
   */
  async cleanupTempFiles(olderThan: Date): Promise<number> {
    // Find temp files older than threshold
    const oldTempFiles = await this.fileRepository.find({
      status: FileStatus.TEMP,
      createdAt: { $lt: olderThan },
    });

    let deletedCount = 0;

    for (const file of oldTempFiles) {
      try {
        // Delete from storage
        await this.storageService.delete(file.storagePath);

        // Delete from database
        await this.fileRepository.getEntityManager().removeAndFlush(file);

        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete temp file ${file.id}:`, error);
      }
    }

    return deletedCount;
  }
}
````

## File: src/meta/meta.module.ts
````typescript
import { Module, Global } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityRegistryService } from './entity-registry.service';
import { MetadataReaderService } from './metadata-reader.service';

@Global()
@Module({
  imports: [MikroOrmModule.forFeature([])], // No specific entities here, just need provider access
  providers: [EntityRegistryService, MetadataReaderService],
  exports: [EntityRegistryService, MetadataReaderService],
})
export class MetaModule {}
````

## File: src/meta/metadata-reader.service.ts
````typescript
import { Injectable } from '@nestjs/common';
import { EntityMetadata, ReferenceKind } from '@mikro-orm/core';
import { EntityRegistryService } from './entity-registry.service';

@Injectable()
export class MetadataReaderService {
  constructor(private readonly registry: EntityRegistryService) {}

  getRelationType(collection: string, field: string): 'm:1' | '1:m' | 'm:n' | '1:1' | null {
    const meta = this.registry.getMetadata(collection);
    const prop = meta.properties[field] as any;
    
    if (!prop) return null;

    if (prop.reference === ReferenceKind.MANY_TO_ONE) return 'm:1';
    if (prop.reference === ReferenceKind.ONE_TO_MANY) return '1:m';
    if (prop.reference === ReferenceKind.MANY_TO_MANY) return 'm:n';
    if (prop.reference === ReferenceKind.ONE_TO_ONE) return '1:1';
    
    return null;
  }

  isRelation(collection: string, field: string): boolean {
    return this.getRelationType(collection, field) !== null;
  }

  getRelatedCollection(collection: string, field: string): string | null {
    const meta = this.registry.getMetadata(collection);
    const prop = meta.properties[field] as any;
    
    if (!prop || !prop.target) return null;

    // Resolve target entity metadata to get its table name
    // Note: MikroORM metadata target can be a function or string or class
    // We assume standard usage where the ORM has resolved it or we can resolve it via registry if needed
    // For now, let's treat it as the EntityName (className) and find the tableName from registry if possible
    // or relying on how MikroORM exposes it.
    
    // Actually, prop.targetMeta is the safest if populated
    if (prop.targetMeta) {
      return prop.targetMeta.tableName;
    }
    
    return null;
  }
}
````

## File: src/storage/storage.service.ts
````typescript
import { Injectable } from '@nestjs/common';
import { ReadStream } from 'fs';
import { IStorageAdapter, StorageResult } from './storage.interface';
import { LocalStorageAdapter } from './local-storage.adapter';

/**
 * Storage service wrapper
 * Provides high-level storage operations
 */
@Injectable()
export class StorageService {
  constructor(private readonly adapter: LocalStorageAdapter) {}

  async saveTemp(
    file: Express.Multer.File,
    id: string,
  ): Promise<StorageResult> {
    return this.adapter.saveTemp(file, id);
  }

  async moveToPermanent(
    tempPath: string,
    permanentPath: string,
  ): Promise<void> {
    return this.adapter.moveToPermanent(tempPath, permanentPath);
  }

  async getStream(path: string): Promise<ReadStream> {
    return this.adapter.getStream(path);
  }

  async delete(path: string): Promise<void> {
    return this.adapter.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.adapter.exists(path);
  }

  async getSize(path: string): Promise<number> {
    return this.adapter.getSize(path);
  }
}
````

## File: test/app.e2e-spec.ts
````typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
````

## File: test/jest-e2e.json
````json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
````

## File: tsconfig.build.json
````json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
````

## File: tsconfig.json
````json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolvePackageJsonExports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "noFallthroughCasesInSwitch": false
  }
}
````

## File: .env.example
````
# ==============================================================================
# SERVER CONFIGURATION
# ==============================================================================
PORT=3000
NODE_ENV=development
# Set to 'true' to run seed data on startup (creates default admin/roles)
RUN_SEEDING=false

# ==============================================================================
# DATABASE CONFIGURATION (PostgreSQL)
# ==============================================================================
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=nestjs_base_db
# Allow global context for simpler MikroORM usage (default false for strictness)
DB_ALLOW_GLOBAL_CONTEXT=false

# ==============================================================================
# AUTHENTICATION & SECURITY
# ==============================================================================
# JWT Secret Key - CHANGE THIS IN PRODUCTION!
JWT_SECRET=your-super-secret-key-change-it-now
# Access Token Lifetime
JWT_EXPIRES_IN=15m
# Refresh Token Lifetime
REFRESH_EXPIRES_IN=7d
# Max number of failed refresh attempts before blocking context (optional)
AUTH_MAX_FAILED_REFRESH=5
# Logging level for auth events: 'basic' or 'verbose'
AUTH_LOG_LEVEL=basic

# ==============================================================================
# CACHE CONFIGURATION (DragonflyDB / Redis)
# ==============================================================================
# Enable caching layer (Optional)
DRAGONFLY_ENABLED=false
DRAGONFLY_HOST=localhost
DRAGONFLY_PORT=6379
DRAGONFLY_PASSWORD=
# Default Cache TTL in seconds (e.g. 300 = 5 minutes)
DRAGONFLY_TTL=300

# ==============================================================================
# QUERY ENGINE CONFIGURATION
# ==============================================================================
# Max nested depth for filtering/relations
QUERY_MAX_DEPTH=3
# Max number of conditions in a single query (hard limit for safety)
QUERY_MAX_CONDITIONS=50
# Max number of fields allowed in sort
QUERY_MAX_SORT_FIELDS=3
# Allow regex in filters? (Warning: performance impact)
QUERY_ALLOW_REGEX=false

# ==============================================================================
# FILE STORAGE
# ==============================================================================
# Driver: 'local' | 's3' (future support)
STORAGE_DRIVER=local
FILE_STORAGE_PATH=./storage

# ==============================================================================
# EXCHANGE WEBMAIL CONFIGURATION (MVP)
# ==============================================================================
# Secret used to derive encryption keys for storing Exchange credentials in Redis
# MUST be a long, random string. NEVER use JWT_SECRET for this.
EXCHANGE_CRED_SECRET=change_this_to_a_complex_random_string_mvp_only

# EWS Endpoint URL (e.g., Office 365)
# Default: https://outlook.office365.com/EWS/Exchange.asmx
EWS_URL=https://outlook.office365.com/EWS/Exchange.asmx
````

## File: .gitignore
````
# compiled output
/dist
/node_modules
/build

# Logs
logs
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# OS
.DS_Store

# Tests
/coverage
/.nyc_output

# IDEs and editors
/.idea
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace

# IDE - VSCode
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json

# dotenv environment variable files
.env
.env.development.local
.env.test.local
.env.production.local
.env.local

# temp directory
.temp
.tmp

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Diagnostic reports (https://nodejs.org/api/report.html)
report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json

repomix-output.md
````

## File: docs/huong_dan.md
````markdown
# Tài liệu Kiến trúc và Hướng dẫn sử dụng Backend

Tài liệu này mô tả kiến trúc của hệ thống backend, được thiết kế với mục tiêu linh hoạt, an toàn và có khả năng mở rộng cao, đồng thời hướng dẫn cách sử dụng và mở rộng hệ thống.

---

## 1. Tổng quan Kiến trúc

Hệ thống được xây dựng dựa trên NestJS và đi theo một kiến trúc hướng module, tách biệt rõ ràng các mối quan tâm (separation of concerns). Nền tảng này không chỉ là một boilerplate thông thường mà là một Headless CMS linh hoạt với các thành phần cốt lõi được thiết kế để trừu tượng hóa các tác vụ lặp lại và tăng cường bảo mật.

**Các thành phần chính bao gồm:**

1.  **Query Engine**: Trái tim của hệ thống, chịu trách nhiệm phân tích và thực thi các truy vấn động từ client.
2.  **Generic Items API**: Lớp giao tiếp chính, cung cấp các endpoint CRUD tự động cho mọi thực thể dữ liệu (entity).
3.  **Authentication & Authorization (RBAC)**: Module bảo mật, quản lý danh tính người dùng và kiểm soát quyền truy cập chi tiết.
4.  **Storage Service**: Cung cấp lớp trừu tượng cho việc lưu trữ và quản lý file.
5.  **Custom Endpoints Framework**: Cung cấp cấu trúc để xây dựng các endpoint với logic nghiệp vụ riêng.
6.  **Configuration Module**: Quản lý cấu hình ứng dụng một cách an toàn và linh hoạt.

---

## 2. Module: Query Engine

### 2.1. Mục đích

Query Engine là bộ não xử lý dữ liệu của hệ thống. Nó cung cấp một cơ chế truy vấn dữ liệu mạnh mẽ, linh hoạt và an toàn, cho phép client yêu cầu dữ liệu phức tạp (lọc, sắp xếp, lồng ghép) thông qua các tham số URL đơn giản mà không cần backend phải định nghĩa trước từng endpoint cụ thể.

### 2.2. Trách nhiệm

- **Phân tích (Parse)** các tham số truy vấn từ URL (`filter`, `sort`, `fields`, `limit`, `offset`, `page`, `deep`, `meta`) thành một cấu trúc dữ liệu trung gian là **AST (Abstract Syntax Tree)**.
- **Biên dịch (Compile)** AST thành câu lệnh truy vấn phù hợp với ORM (MikroORM).
- **Tự động áp dụng** các bộ lọc quyền (permission filters) từ module RBAC để đảm bảo người dùng chỉ thấy dữ liệu họ được phép.
- **Áp đặt** các giới hạn an toàn (query limits) để ngăn chặn các truy vấn có khả năng gây quá tải hệ thống.

### 2.3. Chi Tiết Các Tham Số Truy Vấn

#### **`filter`**: Lọc dữ liệu

Sử dụng `filter` với một đối tượng JSON để lọc kết quả.

- **So sánh bằng:**
  `GET /items/post?filter={"status":"published"}`

- **Toán tử so sánh:**
  `GET /items/post?filter={"views":{"_gte":100}}`
  - Các toán tử được hỗ trợ: `_eq`, `_neq`, `_gt`, `_gte`, `_lt`, `_lte`, `_in`, `_nin`, `_contains`, `_starts_with`.

- **Toán tử logic (`_and`, `_or`):**
  `GET /items/post?filter={"_or":[{"status":"published"},{"status":"archived"}]}`

- **Lọc trên quan hệ lồng nhau:**
  `GET /items/post?filter={"author":{"name":{"_contains":"john"}}}`

#### **`fields`**: Lựa chọn trường dữ liệu

Kiểm soát các trường được trả về.

- **Tất cả các trường của entity chính:**
  `GET /items/post?fields=*`

- **Các trường cụ thể:**
  `GET /items/post?fields=id,title,createdAt`

- **Bao gồm các trường của quan hệ:**
  `GET /items/post?fields=id,title,author.name,author.email`

- **Sử dụng wildcard trên quan hệ:**
  `GET /items/post?fields=*,author.*,comments.*`

#### **`sort`**: Sắp xếp kết quả

Sử dụng danh sách các trường được phân tách bằng dấu phẩy. Thêm tiền tố `-` để sắp xếp giảm dần.

`GET /items/post?sort=-createdAt,title`

#### **`limit`, `offset`, `page`**: Phân trang

- **Giới hạn số lượng và bỏ qua:**
  `GET /items/post?limit=10&offset=20`

- **Dựa trên số trang:**
  `GET /items/post?limit=10&page=3`

#### **`deep`**: Lọc và sắp xếp trên quan hệ sâu

Áp dụng các tùy chọn truy vấn cho các collection lồng nhau.

`GET /items/post?deep[comments][_filter][status][_eq]=approved&deep[comments][_sort]=-createdAt`

#### **`meta`**: Lấy thông tin metadata

Yêu cầu dữ liệu metadata về số lượng bản ghi cùng với kết quả.

- `meta=filter_count`: Trả về số lượng bản ghi khớp với điều kiện `filter` (bỏ qua phân trang).
- `meta=total_count`: Trả về tổng số bản ghi trong collection (bỏ qua `filter` và phân trang).
- `meta=*`: Trả về cả hai.

**Ví dụ:**
`GET /items/post?filter={"status":"published"}&meta=*`

**Phản hồi:**

```json
{
  "data": [
    /* các bài post đã published */
  ],
  "meta": {
    "filter_count": 45,
    "total_count": 150
  }
}
```

### 2.4. Rủi ro / Lưu ý

- **Độ phức tạp của truy vấn**: Cần theo dõi và tối ưu hiệu suất cho các truy vấn phức tạp. Luôn đảm bảo các cột dữ liệu được filter thường xuyên đã được đánh index.
- **Truy vấn quá sâu**: Các truy vấn lồng nhau quá nhiều cấp có thể gây ra vấn đề N+1. QueryEngine đã có cơ chế giới hạn độ sâu truy vấn (mặc định là 3).

---

## 3. Module: Generic Items API

### 3.1. Mục đích

Cung cấp một bộ API RESTful chung cho tất cả các thực thể đã đăng ký, giúp giảm thiểu việc viết code lặp lại cho các thao tác CRUD. Tên `collection` trong URL là **tên bảng** trong CSDL (thường là số ít, viết thường).

### 3.2. Các Endpoint

- `GET /items/:collection`
- `GET /items/:collection/:id`
- `POST /items/:collection`
- `PATCH /items/:collection/:id`
- `DELETE /items/:collection/:id`

### 3.3. Ví Dụ Sử Dụng API

**Lấy danh sách:**
`GET /items/post?fields=id,title&sort=-createdAt`

**Lấy một item:**
`GET /items/post/123`

**Tạo mới:**

```http
POST /items/post
Content-Type: application/json

{
  "title": "Hello World",
  "content": "Đây là nội dung bài viết."
}
```

**Cập nhật:**

```http
PATCH /items/post/123
Content-Type: application/json

{
  "status": "published"
}
```

**Xóa:**
`DELETE /items/post/123`

### 3.4. Rủi ro / Lưu ý

- **Field-level security**: Module này không hỗ trợ kiểm soát quyền ở cấp độ trường. Nếu một vai trò có quyền `read` trên một collection, họ có thể yêu cầu bất kỳ trường nào.
- **Tên collection**: Tên `collection` trong URL là tên bảng trong CSDL (thường là dạng số ít, viết thường), không phải tên class của Entity.

---

## 4. Module: Authentication & Authorization (RBAC)

### 4.1. Mục đích

Đảm bảo chỉ người dùng hợp lệ mới có thể truy cập hệ thống và họ chỉ có thể thực hiện các hành động được cấp phép.

### 4.2. Luồng chính

- **Authentication**: Xác thực qua email/password, cấp cặp Access Token (JWT, ngắn hạn) và Refresh Token (dài hạn, lưu trong CSDL).
- **Authorization**: `PermissionService` kiểm tra quyền của người dùng dựa trên vai trò (Role) và các quyền (Permission) được gán cho vai trò đó trong CSDL.

### 4.3. Điểm mở rộng: Thêm hành động (Action) mới

Mô hình RBAC cho phép thêm các "hành động" tùy chỉnh một cách linh hoạt mà không cần sửa code của `PermissionService`.

1.  **Sử dụng action mới trong code**:
    Trong một service, gọi `assert` với một chuỗi action tùy ý.

    ```typescript
    // src/services/reports.service.ts
    async exportData(collection: string, query: any) {
      // Sử dụng một action tùy chỉnh là 'export_csv'
      this.permissionService.assert(collection, 'export_csv');
      // ... logic xuất dữ liệu
    }
    ```

2.  **Định nghĩa quyền trong CSDL**:
    Trong bảng `permission`, tạo một bản ghi mới:
    - `collection`: "post"
    - `action`: "export_csv"

3.  **Gán quyền cho vai trò**:
    Gán quyền vừa tạo cho một vai trò (ví dụ: "analyst") trong bảng gán quyền-vai trò.

---

## 5. Module: Storage Service

Cung cấp một lớp trừu tượng (`IStorageAdapter`) cho việc quản lý file, giúp ứng dụng không bị phụ thuộc vào một nhà cung cấp lưu trữ cụ thể (local, S3, GCS...). Việc chuyển đổi giữa các nhà cung cấp chỉ cần thay đổi biến môi trường `STORAGE_DRIVER`.

---

## 6. Module: Custom Endpoints & Mở rộng

Cung cấp cấu trúc chuẩn hóa để xây dựng các API có logic nghiệp vụ phức tạp.

### Quy trình xây dựng Custom Endpoint

Luôn tuân theo quy trình: **Controller → Service → QueryEngine/Repository**.

**1. Tạo Controller**:
Controller chỉ chịu trách nhiệm định nghĩa route, nhận request và gọi service. **Không chứa logic nghiệp vụ.**

```typescript
// src/controllers/reports.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from '../services/reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('active-users')
  async getActiveUsers(@Query() query: any) {
    // Ủy quyền hoàn toàn cho Service
    return this.reportsService.getActiveUsers(query);
  }
}
```

**2. Tạo Service**:
Service là nơi chứa toàn bộ logic nghiệp vụ.

```typescript
// src/services/reports.service.ts
import { Injectable } from '@nestjs/common';
import { QueryEngineService } from '../query/query-engine.service';
import { GenericRepository } from '../repository/generic.repository';
import { PermissionService } from '../common/permissions/permission.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly queryEngine: QueryEngineService,
    private readonly repository: GenericRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async getActiveUsers(query: any) {
    // 1. Luôn kiểm tra quyền trước tiên
    this.permissionService.assert('reports', 'generate');

    // 2. Tái sử dụng QueryEngine để phân tích các tham số từ client (filter, sort...)
    const options = await this.queryEngine.parseAndCompile({
      collection: 'user',
      query: query,
    });

    // 3. Thêm logic nghiệp vụ tùy chỉnh
    // Ví dụ: chỉ lấy user hoạt động trong 30 ngày gần nhất
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    options.where = {
      $and: [
        options.where, // Giữ lại các filter từ client
        { status: 'active' },
        { lastLoginAt: { $gte: thirtyDaysAgo } },
      ],
    };

    // 4. Thực thi truy vấn qua GenericRepository
    return this.repository.find('user', options);
  }
}
```

**3. Đăng ký vào Module**:
Đăng ký `ReportsController` và `ReportsService` vào một module (ví dụ `AppModule` hoặc một `ReportsModule` riêng).

### Những điều BẮT BUỘC và KHÔNG ĐƯỢC làm

- ✅ **Luôn** gọi `permissionService.assert()` ở đầu mỗi phương thức service.
- ✅ **Luôn** tái sử dụng `queryEngine.parseAndCompile()` để hỗ trợ các tham số truy vấn từ client.
- ✅ **Luôn** thực thi truy vấn qua `GenericRepository`.
- ❌ **KHÔNG BAO GIỜ** truy cập trực tiếp vào `MikroORM` hay `EntityManager` từ controller hoặc service.
- ❌ **KHÔNG BAO GIỜ** đặt logic nghiệp vụ trong controller.

### Chuyên biệt hóa Endpoint với DTO (Quy trình được khuyến khích)

Khi bạn muốn thêm validation chặt chẽ cho các thao tác `create` và `update` trên một resource, thay vì tạo một custom endpoint hoàn toàn mới, bạn có thể "chuyên biệt hóa" (specialize) endpoint chung `/items/:collection`. Hệ thống cung cấp một script để tự động hóa quy trình này.

#### **Tự động tạo Controller và DTO với `generate-resource.sh`**

Script này giúp tạo nhanh các file cần thiết để áp dụng Data Transfer Objects (DTOs) cho việc validation.

**1. Mục đích**

Để nhanh chóng tạo validation cho body của request `POST` (create) và `PATCH` (update) trên một resource, đảm bảo dữ liệu đầu vào luôn đúng định dạng bạn mong muốn.

**2. Cách sử dụng**

Chạy script từ thư mục gốc của dự án với tên resource ở dạng `PascalCase` (số ít).

```bash
bash generate-resource.sh Product
```

**3. Các file được tạo**

Script sẽ tạo ra các file sau cho resource `Product`:

- `src/controllers/products.controller.ts`: Controller chuyên biệt.
- `src/dto/product/create-product.dto.ts`: DTO cho việc tạo mới.
- `src/dto/product/update-product.dto.ts`: DTO cho việc cập nhật.

**4. Luồng hoạt động**

- Controller mới (`ProductsController`) sẽ "ghi đè" các route `POST /items/product` và `PATCH /items/product/:id`.
- Khi một request `POST` hoặc `PATCH` đến các route này, NestJS sẽ dùng controller chuyên biệt này thay vì `ItemsController` chung.
- Nhờ đó, `ValidationPipe` của NestJS sẽ tự động được áp dụng lên body của request, sử dụng các quy tắc bạn định nghĩa trong `CreateProductDto` và `UpdateProductDto`.
- Các request `GET` và `DELETE` vẫn sẽ được xử lý bởi `ItemsController` chung như bình thường.

**5. Các bước tiếp theo (Rất quan trọng)**

Sau khi chạy script, bạn cần làm những việc sau:

1.  **Định nghĩa DTO**: Mở file `src/dto/product/create-product.dto.ts` và thêm các thuộc tính cùng với các decorator validation từ `class-validator` (ví dụ: `@IsString()`, `@IsNotEmpty()`, `@IsNumber()`).
2.  **Đăng ký Controller**: Mở file `app.module.ts` (hoặc module tương ứng) và **thêm `ProductsController` vào mảng `controllers`**. Nếu không có bước này, controller mới sẽ không hoạt động.

    ```typescript
    // app.module.ts
    import { ProductsController } from './controllers/products.controller';
    // ... các controller khác

    @Module({
      imports: [
        // ...
      ],
      controllers: [AppController, ProductsController, ItemsController, ...] // <--- Thêm vào đây lưu ý thứ tự controller chuyên biệt phải đứng trước controller chung
      providers: [
        // ...
      ],
    })
    export class AppModule {}
    ```

---

## 7. Mở Rộng Chức Năng Cốt Lõi

### 7.1. Thêm một Entity mới

1.  **Tạo file Entity**:

    ```typescript
    // src/database/entities/product.entity.ts
    import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

    @Entity()
    export class Product {
      @PrimaryKey()
      id!: number;

      @Property()
      name!: string;
    }
    ```

2.  **Đăng ký vào `mikro-orm.config.ts`**:

    ```typescript
    // mikro-orm.config.ts
    import { Product } from './entities/product.entity';

    export default defineConfig({
      entities: [User, Post, ..., Product], // Thêm vào đây
    });
    ```

3.  **Hoàn tất!** Hệ thống sẽ tự động tạo ra các endpoint `/items/product` cho bạn.

--- Tính năng định mở rộng --

### 7.2. Thêm Toán Tử Lọc Mới (ví dụ: `_between`)

1.  **Cập nhật `query.ast.ts`**:
    ```typescript
    // src/query/ast/query.ast.ts
    export type FilterOperator =
      | '_eq' | '_neq' | ...
      | '_between'; // Thêm toán tử mới
    ```
2.  **Cập nhật `where.compiler.ts`**:
    Thêm logic biên dịch cho toán tử mới.
    ```typescript
    // src/query/compiler/where.compiler.ts
    // trong hàm compileOperators
    switch (op as FilterOperator) {
      // ... các case khác
      case '_between':
        result['$gte'] = val[0];
        result['$lte'] = val[1];
        break;
    }
    ```
3.  **Sử dụng**:
    `GET /items/product?filter={"price":{"_between":[10,100]}}`

### 7.3. Thêm Tham Số Truy Vấn Mới (ví dụ: `search`)

1.  **Tạo một Parser mới**: `src/query/parser/search.parser.ts`.
2.  **Cập nhật `QueryEngineService`**: Tích hợp parser mới và thêm logic để áp dụng tham số `search` vào mệnh đề `where` của truy vấn (ví dụ: tìm kiếm trên nhiều trường `title`, `content`...).
3.  **Đăng ký Parser mới** vào `QueryModule`.
4.  **Sử dụng**: `GET /items/post?search=nestjs&sort=-createdAt`

---

## 8. Module: Configuration

Quản lý toàn bộ cấu hình ứng dụng qua các biến môi trường (`.env`).

- **KHÔNG BAO GIỜ** hardcode các giá trị nhạy cảm (secrets, passwords, keys) trong code.
- Sử dụng `ConfigService` để truy cập cấu hình một cách an toàn.
- Tham khảo file `.env.example` để biết tất cả các biến môi trường cần thiết cho dự án.
````

## File: src/audit/audit-log.interceptor.ts
````typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Scope,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditLogService } from './audit.service';
import { RequestContext } from '../common/context/request.context';

/**
 * AuditLogInterceptor - Tự động ghi log cho các thao tác CUD
 * 
 * Phân loại logs:
 * 1. DEV LOGS (Console/Logger): Chi tiết kỹ thuật, response time, errors
 * 2. USER LOGS (Database): Audit trail cho business - ai làm gì, lúc nào
 * 
 * Chỉ ghi User Log cho các thao tác thay đổi dữ liệu (POST, PATCH, PUT, DELETE)
 * GET requests chỉ ghi Dev Log
 */
@Injectable({ scope: Scope.REQUEST })
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly requestContext: RequestContext,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, params, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'Unknown';
    const startTime = Date.now();

    // Extract collection and id from params (for /items/:collection/:id routes)
    const collection = params.collection || this.extractCollectionFromUrl(url);
    const targetId = params.id || null;

    // Get user from context
    const user = this.requestContext.user;
    const userId = user?.id || 'anonymous';

    // ========== DEV LOG: Request Start ==========
    this.logger.log(
      `📥 [${method}] ${url} | User: ${userId} | IP: ${ip}`,
    );

    if (method !== 'GET' && body && Object.keys(body).length > 0) {
      // Mask sensitive fields in dev log
      const sanitizedBody = this.sanitizeForDevLog(body);
      this.logger.debug(`   Body: ${JSON.stringify(sanitizedBody)}`);
    }

    return next.handle().pipe(
      tap(async (response) => {
        const duration = Date.now() - startTime;

        // ========== DEV LOG: Request Success ==========
        this.logger.log(
          `✅ [${method}] ${url} | ${duration}ms | User: ${userId}`,
        );

        // ========== USER LOG: Only for CUD operations ==========
        if (this.shouldLogToDatabase(method)) {
          await this.logUserAction({
            userId,
            method,
            collection,
            targetId: targetId || this.extractIdFromResponse(response),
            action: this.mapMethodToAction(method),
            success: true,
            ip,
            userAgent,
            // Don't log full body to DB - only essential info
            details: this.sanitizeForUserLog(body, response),
          });
        }
      }),
      catchError(async (error) => {
        const duration = Date.now() - startTime;

        // ========== DEV LOG: Request Error ==========
        this.logger.error(
          `❌ [${method}] ${url} | ${duration}ms | User: ${userId} | Error: ${error.message}`,
        );
        this.logger.debug(`   Stack: ${error.stack}`);

        // ========== USER LOG: Failed CUD operations ==========
        if (this.shouldLogToDatabase(method)) {
          await this.logUserAction({
            userId,
            method,
            collection,
            targetId,
            action: this.mapMethodToAction(method),
            success: false,
            ip,
            userAgent,
            details: {
              error: error.message,
              errorCode: error.status || 500,
            },
          });
        }

        throw error;
      }),
    );
  }

  /**
   * Xác định có nên ghi vào database không
   * Chỉ ghi cho các thao tác thay đổi dữ liệu
   */
  private shouldLogToDatabase(method: string): boolean {
    return ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase());
  }

  /**
   * Map HTTP method sang action name cho User Log
   */
  private mapMethodToAction(method: string): string {
    const actionMap: Record<string, string> = {
      POST: 'create',
      PATCH: 'update',
      PUT: 'update',
      DELETE: 'delete',
    };
    return actionMap[method.toUpperCase()] || method.toLowerCase();
  }

  /**
   * Extract collection name from URL nếu không có trong params
   * Ví dụ: /items/posts/1 -> posts, /auth/login -> auth
   */
  private extractCollectionFromUrl(url: string): string {
    const parts = url.split('/').filter(Boolean);
    // Remove query params
    const cleanParts = parts.map(p => p.split('?')[0]);
    
    // If URL starts with /items/, the collection is the next part
    if (cleanParts[0] === 'items' && cleanParts[1]) {
      return cleanParts[1];
    }
    
    // Otherwise use the first part as collection (e.g., /auth/login -> auth)
    return cleanParts[0] || 'unknown';
  }

  /**
   * Extract ID từ response nếu là create operation
   */
  private extractIdFromResponse(response: any): string | null {
    if (response && typeof response === 'object') {
      return String(response.id || response.data?.id || null);
    }
    return null;
  }

  /**
   * Sanitize body cho DEV LOG - ẩn sensitive fields
   */
  private sanitizeForDevLog(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'token', 'refreshToken', 'secret', 'apiKey', 'accessToken'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***HIDDEN***';
      }
    }

    return sanitized;
  }

  /**
   * Sanitize data cho USER LOG - chỉ giữ thông tin cần thiết
   * Không lưu passwords, tokens, hoặc data quá lớn
   */
  private sanitizeForUserLog(body: any, response: any): Record<string, any> {
    const details: Record<string, any> = {};

    // Chỉ log các fields quan trọng, không log sensitive data
    if (body && typeof body === 'object') {
      const allowedFields = ['title', 'name', 'email', 'status', 'role', 'collection'];
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          details[`input_${field}`] = body[field];
        }
      }
    }

    // Log result ID nếu có
    if (response?.id) {
      details.resultId = response.id;
    }

    return Object.keys(details).length > 0 ? details : {};
  }

  /**
   * Ghi User Log vào database
   */
  private async logUserAction(data: {
    userId: string | number;
    method: string;
    collection: string;
    targetId: string | null;
    action: string;
    success: boolean;
    ip: string;
    userAgent: string;
    details?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.auditLogService.logAction(
        data.userId !== 'anonymous' ? { id: data.userId } as any : null,
        data.action,
        data.collection,
        data.targetId || 'new',
        {
          ...data.details,
          success: data.success,
          ip: data.ip,
          userAgent: data.userAgent,
        },
      );
    } catch (error) {
      // Không để audit log failure làm fail request chính
      this.logger.error(`Failed to save audit log: ${error.message}`);
    }
  }
}
````

## File: src/audit/audit.service.ts
````typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager, FilterQuery } from '@mikro-orm/core';
import { AuditLog } from '../database/entities/audit-log.entity';
import { User } from '../database/entities/user.entity';

/**
 * AuditLogService - Quản lý User Logs (Business Audit Trail)
 * 
 * User Logs được lưu vào database để:
 * - Tracking ai đã làm gì, lúc nào
 * - Compliance và security audit
 * - Rollback/debugging khi cần
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger('AuditLogService');

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: EntityRepository<AuditLog>,
    private readonly em: EntityManager,
  ) {}

  /**
   * Ghi một User Log entry vào database
   * 
   * @param user - User object hoặc { id } object, null nếu anonymous
   * @param action - Hành động: 'create', 'update', 'delete', 'login', 'logout', etc.
   * @param collection - Collection/entity bị ảnh hưởng
   * @param targetId - ID của record bị ảnh hưởng
   * @param details - Chi tiết bổ sung (không chứa sensitive data)
   */
  async logAction(
    user: User | { id: string | number } | null,
    action: string,
    collection: string,
    targetId: string,
    details?: Record<string, any>,
  ): Promise<void> {
    try {
      const logEntry = this.em.create(AuditLog, {
        user: user ? { id: String((user as any).id) } as User : undefined,
        action,
        collection,
        targetId: String(targetId),
        details,
        timestamp: new Date(),
      });

      await this.em.persistAndFlush(logEntry);
      
      this.logger.debug(
        `📝 Audit: [${action}] ${collection}/${targetId} by user ${(user as any)?.id || 'anonymous'}`,
      );
    } catch (error) {
      // Log error but don't throw - audit should not break main flow
      this.logger.error(`Failed to save audit log: ${error.message}`);
    }
  }

  /**
   * Ghi log cho authentication events
   */
  async logAuth(
    userId: string | number | null,
    action: 'login' | 'logout' | 'login_failed' | 'token_refresh' | 'password_reset',
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logAction(
      userId ? { id: userId } : null,
      action,
      'auth',
      String(userId || 'anonymous'),
      details,
    );
  }

  /**
   * Query User Logs với filters
   * Useful cho admin dashboard hoặc compliance reports
   */
  async findLogs(options: {
    userId?: string;
    collection?: string;
    action?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const where: FilterQuery<AuditLog> = {};

    if (options.userId) {
      where.user = { id: options.userId };
    }
    if (options.collection) {
      where.collection = options.collection;
    }
    if (options.action) {
      where.action = options.action;
    }
    if (options.fromDate || options.toDate) {
      where.timestamp = {};
      if (options.fromDate) {
        where.timestamp.$gte = options.fromDate;
      }
      if (options.toDate) {
        where.timestamp.$lte = options.toDate;
      }
    }

    const [data, total] = await this.auditLogRepository.findAndCount(where, {
      orderBy: { timestamp: 'DESC' },
      limit: options.limit || 50,
      offset: options.offset || 0,
      populate: ['user'],
    });

    return { data, total };
  }

  /**
   * Lấy logs của một user cụ thể
   */
  async getLogsByUser(userId: string, limit = 20): Promise<AuditLog[]> {
    return this.auditLogRepository.find(
      { user: { id: userId } },
      {
        orderBy: { timestamp: 'DESC' },
        limit,
      },
    );
  }

  /**
   * Lấy logs của một record cụ thể (history của 1 item)
   */
  async getLogsByTarget(collection: string, targetId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find(
      { collection, targetId },
      {
        orderBy: { timestamp: 'DESC' },
        populate: ['user'],
      },
    );
  }
}
````

## File: src/auth/guards/jwt-auth.guard.ts
````typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    if (err || !user) {
      console.log('🔴 [DEBUG] JwtAuthGuard Failure:');
      console.log('   Error:', err);
      console.log('   Info:', info?.message || info);
      let message = (info?.message || info).toLowerCase();
      if (message === 'jwt expired') {
        message = 'Token hết hạn vui lòng đăng nhập lại !';
      } else if (message === 'invalid signature' || message === 'jwt malformed' || message === 'no auth token') {
        message = 'Token không hợp lệ !';
      }
      throw err || new UnauthorizedException(message);
    }
    return user;
  }
}
````

## File: src/auth/strategies/jwt.strategy.ts
````typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

console.log('🔵 JwtStrategy FILE LOADED');

import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production',
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      return null;
    }
    
    const user = {
      id: payload.sub
    };
    
    return user;
  }
}
````

## File: src/common/context/request.context.ts
````typescript
import { Injectable, Scope } from '@nestjs/common';

export interface UserContext {
  id: string | number;
  role: string;
  email?: string;
  permissions?: any[];
}

@Injectable({ scope: Scope.REQUEST })
export class RequestContext {
  private _user: UserContext | null = null;
  private _tenantId: string | null = null;

  get user(): UserContext | null {
    return this._user;
  }

  set user(user: UserContext | null) {
    this._user = user;
  }

  
  get tenantId(): string | null {
    return this._tenantId;
  }

  set tenantId(id: string | null) {
    this._tenantId = id;
  }
}
````

## File: src/config/auth.config.ts
````typescript
import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '7d',
  maxFailedRefreshInfo: parseInt(process.env.AUTH_MAX_FAILED_REFRESH || '5', 10),
  logLevel: process.env.AUTH_LOG_LEVEL || 'basic',
}));
````

## File: src/config/database.config.ts
````typescript
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  name: process.env.DB_NAME || 'postgres',
  allowGlobalContext: process.env.DB_ALLOW_GLOBAL_CONTEXT === 'true' || process.env.NODE_ENV !== 'production',
}));
````

## File: src/exchange/exchange.module.ts
````typescript
import { Module } from '@nestjs/common';
import { ExchangeController } from './controllers/exchange.controller';
import { ExchangeAuthService } from './services/exchange-auth.service';
import { CacheModule } from '../common/cache/cache.module';
import { CommonModule } from '../common/common.module';
import { MailService } from './services/mail.service';
import { ImapMailProvider } from './services/imap-mail.provider';

@Module({
  imports: [CacheModule, CommonModule],
  controllers: [ExchangeController],
  providers: [
    ExchangeAuthService,
    ImapMailProvider,
    MailService,
  ],
  exports: [MailService],
})
export class ExchangeModule {}
````

## File: src/meta/entity-registry.service.ts
````typescript
import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import { MikroORM, EntityMetadata } from '@mikro-orm/core';

@Injectable()
export class EntityRegistryService implements OnModuleInit {
  private readonly logger = new Logger(EntityRegistryService.name);
  private readonly collectionMap = new Map<string, string>(); // collectionName -> EntityClassName
  private readonly entityMap = new Map<string, EntityMetadata>(); // EntityClassName -> Metadata

  constructor(private readonly orm: MikroORM) {}

  async onModuleInit() {
    this.scanEntities();
  }

  private scanEntities() {
    const metadata = this.orm.getMetadata().getAll();
    for (const meta of Object.values(metadata)) {
      // Use tableName as the collection identifier
      const collectionName = meta.tableName;
      const entityName = meta.className;

      if (!collectionName) {
        continue;
      }

      this.collectionMap.set(collectionName, entityName);
      this.entityMap.set(entityName, meta);
      
      this.logger.log(`Registered collection: ${collectionName} -> ${entityName}`);
    }
  }

  getEntityName(collection: string): string {
    const entityName = this.collectionMap.get(collection);
    if (!entityName) {
      throw new NotFoundException(`Collection ${collection} not found`);
    }
    return entityName;
  }

  getMetadata(collection: string): EntityMetadata {
    const entityName = this.getEntityName(collection);
    return this.entityMap.get(entityName)!;
  }

  hasCollection(collection: string): boolean {
    console.log("collectionMap",this.collectionMap);
    return this.collectionMap.has(collection);
  }
}
````

## File: src/storage/local-storage.adapter.ts
````typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs, createReadStream, ReadStream } from 'fs';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import {
  IStorageAdapter,
  StorageResult,
} from './storage.interface';

/**
 * Local filesystem storage adapter
 * Handles file operations using Node.js fs module with streaming
 */
@Injectable()
export class LocalStorageAdapter implements IStorageAdapter {
  private readonly storagePath: string;

  constructor(private readonly configService: ConfigService) {
    this.storagePath =
      this.configService.get<string>('FILE_STORAGE_PATH') || './storage';
  }

  async upload(file: Express.Multer.File, path: string): Promise<StorageResult> {
    const fullPath = join(this.storagePath, path);
    await this.ensureDir(dirname(fullPath));
    await fs.writeFile(fullPath, file.buffer);
    return {
        storedName: path.split('/').pop() || path,
        storagePath: path,
        size: file.size,
    };
  }

  async getSignedUrl(path: string): Promise<string> {
      // For local storage, we just return the relative path. 
      // In a real app, this might need to be prefixed with the API host URL 
      // or mapped to a static file serve route.
      return path;
  }

  /**
   * Save uploaded file to temporary storage
   */
  async saveTemp(
    file: Express.Multer.File,
    id: string,
  ): Promise<StorageResult> {
    const tempDir = join(this.storagePath, 'temp');
    await this.ensureDir(tempDir);

    const storedName = id;
    const storagePath = `temp/${storedName}`;
    const fullPath = join(this.storagePath, storagePath);

    // Write file using stream (no memory buffering)
    await fs.writeFile(fullPath, file.buffer);

    return {
      storedName,
      storagePath,
      size: file.size,
    };
  }

  /**
   * Move file from temp to permanent storage
   * Uses atomic rename operation when possible
   */
  async moveToPermanent(
    tempPath: string,
    permanentPath: string,
  ): Promise<void> {
    const fullTempPath = join(this.storagePath, tempPath);
    const fullPermanentPath = join(this.storagePath, permanentPath);

    // Ensure permanent directory exists
    await this.ensureDir(dirname(fullPermanentPath));

    // Atomic move (rename syscall)
    await fs.rename(fullTempPath, fullPermanentPath);
  }

  /**
   * Get readable stream for file
   * Enables streaming without loading entire file into memory
   */
  async getStream(path: string): Promise<ReadStream> {
    const fullPath = join(this.storagePath, path);

    // Verify file exists before creating stream
    await fs.access(fullPath);

    return createReadStream(fullPath);
  }

  /**
   * Delete file from storage
   */
  async delete(path: string): Promise<void> {
    const fullPath = join(this.storagePath, path);
    await fs.unlink(fullPath);
  }

  /**
   * Check if file exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      const fullPath = join(this.storagePath, path);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file size in bytes
   */
  async getSize(path: string): Promise<number> {
    const fullPath = join(this.storagePath, path);
    const stats = await fs.stat(fullPath);
    return stats.size;
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
````

## File: src/storage/storage.interface.ts
````typescript
import { ReadStream } from 'fs';

export interface StorageResult {
  storedName: string;
  storagePath: string;
  size: number;
}

/**
 * Storage adapter interface for abstracting file storage operations
 * Enables swapping between local filesystem, S3, GCS, etc.
 */
export interface IStorageAdapter {
  /**
   * Save file to storage (Generic Upload)
   * This is the preferred method for general upload usage.
   */
  upload?(file: Express.Multer.File, path: string): Promise<StorageResult>;

  /**
   * Get a signed URL for public or temporary access.
   * For local storage, this might return a relative publicly accessible path.
   */
  getSignedUrl?(path: string, expiresIn?: number): Promise<string>;

  /**
   * Save file to temporary storage
   * @param file Multer file object
   * @param id ULID identifier for the file
   * @returns Storage metadata
   */
  saveTemp(file: Express.Multer.File, id: string): Promise<StorageResult>;

  /**
   * Move file from temporary to permanent storage
   * @param tempPath Temporary storage path
   * @param permanentPath Permanent storage path
   */
  moveToPermanent(tempPath: string, permanentPath: string): Promise<void>;

  /**
   * Get a readable stream for a file
   * @param path Storage path
   * @returns Readable stream
   */
  getStream(path: string): Promise<ReadStream>;

  /**
   * Delete a file from storage
   * @param path Storage path
   */
  delete(path: string): Promise<void>;

  /**
   * Check if file exists in storage
   * @param path Storage path
   * @returns True if file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file size
   * @param path Storage path
   * @returns File size in bytes
   */
  getSize(path: string): Promise<number>;
}
````

## File: src/auth/auth.controller.ts
````typescript
import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

/**
 * AuthController - Handles authentication endpoints.
 * 
 * Endpoints:
 * - POST /auth/login - Login with email/password
 * - POST /auth/refresh - Rotate refresh token
 * - POST /auth/logout - Revoke refresh token
 * - POST /auth/reset-password-request - Request password reset token
 * - POST /auth/reset-password - Reset password with token
 * - GET /auth/me - Get current user info (requires JWT)
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: { id: string; email: string }) {
    return this.authService.getMe(user.id);
  }
}
````

## File: src/common/cache/dragonfly.service.ts
````typescript
import { Injectable, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import dragonflyConfig from '../../config/dragonfly.config';

@Injectable()
export class DragonflyService implements OnModuleDestroy {
  private readonly logger = new Logger(DragonflyService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(
    @Inject(dragonflyConfig.KEY)
    private readonly config: any,
  ) {
    if (this.config.enabled) {
      this.initClient();
    }
  }

  private initClient() {
    this.logger.log(`Initializing DragonflyDB connection to ${this.config.host}:${this.config.port}`);
    
    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      // Retry strategy: keep trying to reconnect but don't block
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      // Don't crash on connection error
      enableOfflineQueue: false, 
      lazyConnect: true, // Don't connect immediately in constructor
    });

    this.client.connect().catch(err => {
        this.logger.error(`Failed to connect to DragonflyDB initialy: ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Connected to DragonflyDB');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      this.logger.error(`❌ DragonflyDB Error: ${err.message}`);
      this.isConnected = false;
    });
    
    this.client.on('close', () => {
       if (this.isConnected) {
           this.logger.warn('DragonflyDB connection closed');
           this.isConnected = false;
       }
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  get enabled(): boolean {
    return this.config.enabled && this.isConnected && !!this.client;
  }

  /**
   * Get value from cache safely. Returns null if error or miss.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.client) return null;

    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.warn(`Failed to get cache key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Set value to cache safely.
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.enabled || !this.client) return;

    try {
      const serialized = JSON.stringify(value);
      const effectiveTTL = ttl || this.config.ttl;
      
      if (effectiveTTL > 0) {
        await this.client.set(key, serialized, 'EX', effectiveTTL);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.logger.warn(`Failed to set cache key ${key}: ${error.message}`);
    }
  }

  /**
   * Delete key from cache safely
   */
  async del(key: string): Promise<void> {
     if (!this.enabled || !this.client) return;
     try {
         await this.client.del(key);
     } catch (error) {
         this.logger.warn(`Failed to del cache key ${key}: ${error.message}`);
     }
  }
  /**
   * Check if a key exists in cache
   * @param key - The cache key to check
   * @returns true if key exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    if (!this.enabled || !this.client) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1; // Redis EXISTS returns number of keys that exist (1 or 0 for single key)
    } catch (error) {
      this.logger.warn(`Failed to check existence of key ${key}: ${error.message}`);
      return false;
    }
  }
   /**
   * Set expiration time for a key (in seconds)
   * @param key - The cache key
   * @param ttl - Time to live in seconds
   * @returns true if expiration was set, false otherwise
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.enabled || !this.client) return false;

    try {
      const result = await this.client.expire(key, ttl);
      return result === 1; // Redis EXPIRE returns 1 if successful, 0 if key doesn't exist
    } catch (error) {
      this.logger.warn(`Failed to set expiration for key ${key}: ${error.message}`);
      return false;
    }
  }
  /**
   * Set value ONLY if it does not exist (SET NX).
   * @returns true if set, false if already exists
   */
  async setIfNotExist(key: string, value: any, ttlSeconds: number): Promise<boolean> {
    if (!this.enabled || !this.client) return false;

    try {
      const serialized = JSON.stringify(value);
      const result = await this.client.set(key, serialized, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.warn(`Failed to set NX cache key ${key}: ${error.message}`);
      return false;
    }
  }
}
````

## File: src/common/common.module.ts
````typescript
import { Module, Global } from '@nestjs/common';
import { RequestContext } from './context/request.context';
import { RequestContextInterceptor } from './interceptors/request-context.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DragonflyService } from './cache/dragonfly.service';
import { CacheModule } from './cache/cache.module';

@Global()
@Module({
  imports: [CacheModule],
  providers: [
    RequestContext, 
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
  exports: [RequestContext, CacheModule],
})
export class CommonModule {}
````

## File: src/database/migrations/.snapshot-postgres.json
````json
{
  "namespaces": [
    "public"
  ],
  "name": "public",
  "tables": [
    {
      "columns": {
        "id": {
          "name": "id",
          "type": "uuid",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "default": "gen_random_uuid()",
          "mappedType": "uuid"
        },
        "original_name": {
          "name": "original_name",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "stored_name": {
          "name": "stored_name",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "mime_type": {
          "name": "mime_type",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "size": {
          "name": "size",
          "type": "bigint",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "mappedType": "bigint"
        },
        "storage_path": {
          "name": "storage_path",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "status": {
          "name": "status",
          "type": "text",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "default": "'TEMP'",
          "enumItems": [
            "TEMP",
            "ACTIVE",
            "DELETED"
          ],
          "mappedType": "enum"
        },
        "custom_metadata": {
          "name": "custom_metadata",
          "type": "jsonb",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": true,
          "mappedType": "json"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        }
      },
      "name": "files",
      "schema": "public",
      "indexes": [
        {
          "columnNames": [
            "status"
          ],
          "composite": false,
          "keyName": "files_status_index",
          "constraint": false,
          "primary": false,
          "unique": false
        },
        {
          "keyName": "files_pkey",
          "columnNames": [
            "id"
          ],
          "composite": false,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {},
      "nativeEnums": {}
    },
    {
      "columns": {
        "id": {
          "name": "id",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "email": {
          "name": "email",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "is_active": {
          "name": "is_active",
          "type": "boolean",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "default": "true",
          "mappedType": "boolean"
        },
        "mailbox_initialized": {
          "name": "mailbox_initialized",
          "type": "boolean",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "default": "false",
          "mappedType": "boolean"
        },
        "created_at": {
          "name": "created_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        },
        "updated_at": {
          "name": "updated_at",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        }
      },
      "name": "users",
      "schema": "public",
      "indexes": [
        {
          "columnNames": [
            "email"
          ],
          "composite": false,
          "keyName": "users_email_unique",
          "constraint": true,
          "primary": false,
          "unique": true
        },
        {
          "keyName": "users_pkey",
          "columnNames": [
            "id"
          ],
          "composite": false,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {},
      "nativeEnums": {}
    },
    {
      "columns": {
        "id": {
          "name": "id",
          "type": "bigserial",
          "unsigned": false,
          "autoincrement": true,
          "primary": true,
          "nullable": false,
          "mappedType": "bigint"
        },
        "user_id": {
          "name": "user_id",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": true,
          "length": 255,
          "mappedType": "string"
        },
        "collection": {
          "name": "collection",
          "type": "varchar(100)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 100,
          "mappedType": "string"
        },
        "action": {
          "name": "action",
          "type": "varchar(50)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 50,
          "mappedType": "string"
        },
        "target_id": {
          "name": "target_id",
          "type": "varchar(255)",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 255,
          "mappedType": "string"
        },
        "details": {
          "name": "details",
          "type": "jsonb",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": true,
          "mappedType": "json"
        },
        "timestamp": {
          "name": "timestamp",
          "type": "timestamptz",
          "unsigned": false,
          "autoincrement": false,
          "primary": false,
          "nullable": false,
          "length": 6,
          "mappedType": "datetime"
        }
      },
      "name": "audit_logs",
      "schema": "public",
      "indexes": [
        {
          "columnNames": [
            "user_id"
          ],
          "composite": false,
          "keyName": "audit_log_user_id_index",
          "constraint": false,
          "primary": false,
          "unique": false
        },
        {
          "columnNames": [
            "collection"
          ],
          "composite": false,
          "keyName": "audit_log_collection_index",
          "constraint": false,
          "primary": false,
          "unique": false
        },
        {
          "columnNames": [
            "target_id"
          ],
          "composite": false,
          "keyName": "audit_log_target_id_index",
          "constraint": false,
          "primary": false,
          "unique": false
        },
        {
          "keyName": "audit_logs_collection_target_id_index",
          "columnNames": [
            "collection",
            "target_id"
          ],
          "composite": true,
          "constraint": false,
          "primary": false,
          "unique": false
        },
        {
          "keyName": "audit_logs_pkey",
          "columnNames": [
            "id"
          ],
          "composite": false,
          "constraint": true,
          "primary": true,
          "unique": true
        }
      ],
      "checks": [],
      "foreignKeys": {
        "audit_logs_user_id_foreign": {
          "constraintName": "audit_logs_user_id_foreign",
          "columnNames": [
            "user_id"
          ],
          "localTableName": "public.audit_logs",
          "referencedColumnNames": [
            "id"
          ],
          "referencedTableName": "public.users",
          "deleteRule": "set null",
          "updateRule": "cascade"
        }
      },
      "nativeEnums": {}
    }
  ],
  "nativeEnums": {}
}
````

## File: src/exchange/services/exchange-auth.service.ts
````typescript
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DragonflyService } from 'src/common/cache/dragonfly.service';
import { ulid } from 'ulid';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

// exchange-auth.service.ts
@Injectable()
export class ExchangeAuthService {
  private readonly logger = new Logger(ExchangeAuthService.name);
  private readonly SESSION_TTL = 3600; // 1 hour
  private readonly REFRESH_TTL = 7 * 24 * 3600; // 7 days

  constructor(
    private readonly cache: DragonflyService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate secure session token
   */
  private generateSessionToken(): string {
    return ulid(); // or crypto.randomBytes(32).toString('hex')
  }

  /**
   * Derive encryption key from session token
   */
  private async deriveKey(sessionToken: string): Promise<Buffer> {
    const secret = this.configService.get<string>('EXCHANGE_CRED_SECRET');
    if (!secret) {
      throw new Error('EXCHANGE_CRED_SECRET is not configured');
    }
    
    const hash = await argon2.hash(secret, {
      salt: Buffer.from(sessionToken.slice(0, 16)), // Use part of token as salt
      raw: true,
      hashLength: 32,
      timeCost: 3,
      memoryCost: 65536, // 64 MB
      parallelism: 1,
      type: argon2.argon2id
    });
    
    return hash;
  }

  private encrypt(text: string, key: Buffer): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decrypt(encryptedText: string, key: Buffer): string {
    const [ivHex, authTagHex, contentHex] = encryptedText.split(':');
    if (!ivHex || !authTagHex || !contentHex) {
      throw new Error('Invalid encrypted format');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(contentHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Login and return access and refresh tokens
   */
  async login(email: string, password: string): Promise<{ accessToken: string, refreshToken: string }> {
    // 1. Verify credentials against Exchange/IMAP
    await this.verifyExchangeCredentials(email, password);

    // 2. Issue tokens
    return this.issueTokens(email, password);
  }

  /**
   * Internal helper to issue both tokens
   */
  private async issueTokens(email: string, password: string): Promise<{ accessToken: string, refreshToken: string }> {
    // A. Issue Access Token (Session)
    const accessToken = this.generateSessionToken();
    const accessKey = await this.deriveKey(accessToken);
    const encryptedEmail = this.encrypt(email, accessKey);
    const encryptedPass = this.encrypt(password, accessKey);

    await this.cache.set(
      `exchange:session:${accessToken}`, 
      { e: encryptedEmail, p: encryptedPass, createdAt: Date.now() }, 
      this.SESSION_TTL
    );

    // B. Issue Refresh Token
    const tokenId = ulid();
    const tokenSecret = crypto.randomBytes(32).toString('base64url');
    const secretHash = await argon2.hash(tokenSecret);
    
    // We encrypt credentials for the refresh token record too, using tokenId as salt basis
    const refreshKey = await this.deriveKey(tokenId);
    const re = this.encrypt(email, refreshKey);
    const rp = this.encrypt(password, refreshKey);

    await this.cache.set(
      `exchange:refresh:${tokenId}`,
      { h: secretHash, e: re, p: rp },
      this.REFRESH_TTL
    );

    return { 
      accessToken, 
      refreshToken: `${tokenId}.${tokenSecret}` 
    };
  }

  /**
   * Rotate refresh token
   */
  async rotateRefreshToken(fullToken: string): Promise<{ accessToken: string, refreshToken: string }> {
    const [tokenId, tokenSecret] = fullToken.split('.');
    
    if (!tokenId || !tokenSecret) {
      throw new UnauthorizedException('Token không hợp lệ !');
    }

    const stored = await this.cache.get<{ h: string, e: string, p: string }>(
      `exchange:refresh:${tokenId}`
    );

    if (!stored) {
      throw new UnauthorizedException('Token đã hết hạn hoặc không tồn tại !');
    }

    // Verify secret
    const isValid = await argon2.verify(stored.h, tokenSecret);
    if (!isValid) {
      throw new UnauthorizedException('Token không hợp lệ !');
    }

    // Decrypt credentials from refresh record
    try {
      const key = await this.deriveKey(tokenId);
      const email = this.decrypt(stored.e, key);
      const password = this.decrypt(stored.p, key);

      // Revoke old refresh token
      await this.cache.del(`exchange:refresh:${tokenId}`);

      // Issue new tokens
      this.logger.log(`Exchange tokens rotated for ${email}`);
      return this.issueTokens(email, password);
    } catch (error) {
      this.logger.error(`Failed to rotate exchange token: ${error.message}`);
      throw new UnauthorizedException('Không thể làm mới token !');
    }
  }

  /**
   * Verify Exchange credentials
   */
  private async verifyExchangeCredentials(email: string, password: string): Promise<void> {
    const host = this.configService.get<string>('IMAP_HOST');
    const port = this.configService.get<number>('IMAP_PORT', 993);
    const secure = this.configService.get<boolean>('IMAP_SECURE', true);
    
    if (!host) {
      throw new Error('IMAP_HOST is not configured');
    }

    const { ImapFlow } = await import('imapflow');
    const client = new ImapFlow({
      host,
      port,
      secure,
      auth: {
        user: email,
        pass: password,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false
      },
      logger: false,
    });

    try {
      await client.connect();
      await client.logout();
      this.logger.log(`Exchange authentication successful for ${email}`);
    } catch (error) {
      this.logger.warn(`Exchange authentication failed for ${email}: ${error.message}`);
      throw new UnauthorizedException('Invalid Exchange credentials');
    }
  }

  /**
   * Get credentials by session token
   */
  async getCredentials(sessionToken: string): Promise<{email: string, password: string} | null> {
    const session = await this.cache.get<{e: string, p: string, createdAt: number}>(
      `exchange:session:${sessionToken}`
    );
    
    if (!session) {
      return null;
    }

    try {
      const key = await this.deriveKey(sessionToken);
      const email = this.decrypt(session.e, key);
      const password = this.decrypt(session.p, key);
      
      return { email, password };
    } catch (error) {
      this.logger.error(`Failed to decrypt credentials for session ${sessionToken}`);
      await this.logout(sessionToken); // Clean up corrupted session
      return null;
    }
  }

  /**
   * Refresh session TTL
   */
  async refreshSession(sessionToken: string): Promise<boolean> {
    const session = await this.cache.get(`exchange:session:${sessionToken}`);
    if (!session) {
      return false;
    }
    
    await this.cache.expire(`exchange:session:${sessionToken}`, this.SESSION_TTL);
    return true;
  }

  /**
   * Logout and clear session
   */
  async logout(sessionToken: string): Promise<void> {
    await this.cache.del(`exchange:session:${sessionToken}`);
    this.logger.log(`Session ${sessionToken} terminated`);
  }

  /**
   * Validate session exists and is valid
   */
  async validateSession(sessionToken: string): Promise<boolean> {
    const exists = await this.cache.exists(`exchange:session:${sessionToken}`);
    return exists;
  }
}
````

## File: src/auth/auth.module.ts
````typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../database/entities/user.entity';
import { CommonModule } from '../common/common.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuditLogModule } from '../audit/audit.module';

@Module({
  imports: [
    CommonModule,
    AuditLogModule,
    PassportModule.register({defaultStrategy: 'jwt'}),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production',
        signOptions: {
          expiresIn: configService.get<any>('JWT_EXPIRES_IN') || '15m',
        },
      }),
    }),
    MikroOrmModule.forFeature([User]),
  ],
  providers: [AuthService, JwtStrategy,JwtAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy, PassportModule,JwtModule,JwtAuthGuard],
})
export class AuthModule {}
````

## File: src/database/entities/user.entity.ts
````typescript
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { ulid } from 'ulid';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey()
  id: string = ulid();

  @Property({ unique: true })
  email!: string;

  @Property({ default: true })
  isActive: boolean = true;

  @Property({ default: false })
  mailboxInitialized: boolean = false;

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();
}
````

## File: src/exchange/controllers/exchange.controller.ts
````typescript
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Query,
  Param,
  UseInterceptors,
  Req,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ExchangeAuthService } from '../services/exchange-auth.service';
import { MailService } from '../services/mail.service';
import { ExchangeLoginDto, SendMailDto, MoveMailDto } from '../dto/exchange.dto';
import { ExchangeErrorInterceptor } from '../interceptors/exchange-error.interceptor';
import type { Request, Response } from 'express'; // Import từ express
import { ExchangeAuthGuard } from 'src/auth/guards/exchange-auth.guard';

@Controller('webmail')
@UseInterceptors(ExchangeErrorInterceptor)
export class ExchangeController {
  constructor(
    private readonly authService: ExchangeAuthService,
    private readonly mailService: MailService,
  ) {}

  @Post('auth/login')
  async login(
    @Body() dto: ExchangeLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(dto.email, dto.password);

    // Maintain cookie for legacy support if needed, but return in body as well
    res.cookie('exchange_session', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000,
    });

    return {
      success: true,
      accessToken,
      refreshToken,
    };
  }

  @Post('auth/refresh')
  async refresh(
    @Body('refreshToken') refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.rotateRefreshToken(refreshToken);

    res.cookie('exchange_session', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000,
    });

    return tokens;
  }

  @Post('auth/logout')
  async logout(
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request, 
    @Res({ passthrough: true }) res: Response
  ) {
    const sessionToken = req.cookies['exchange_session'];

    if (sessionToken) {
      await this.authService.logout(sessionToken);
    }
    
    // Revoke refresh token as well if provided
    if (refreshToken) {
        const [tokenId] = refreshToken.split('.');
        if (tokenId) {
            await (this.authService as any).cache.del(`exchange:refresh:${tokenId}`);
        }
    }

    res.clearCookie('exchange_session');
    return { success: true, message: 'Đăng xuất thành công' };
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('folders')
  async getFolders() {
    return this.mailService.getFolders();
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('mail')
  async list(
    @Query('folder') folder: string = 'inbox',
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.mailService.getMessages(folder, Number(page), Number(pageSize));
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('mail/search')
  async search(@Query('q') q: string, @Query('page') page: number = 1) {
    return this.mailService.searchMessages(q, Number(page));
  }

  @UseGuards(ExchangeAuthGuard)
  @Get('mail/:id')
  async check(@Param('id') id: string) {
    return this.mailService.getMessage(id);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/send')
  async send(@Body() dto: SendMailDto) {
    return this.mailService.sendMessage(dto);
  }

  @UseGuards(ExchangeAuthGuard)
  @Post('mail/move')
  async move(@Body() dto: MoveMailDto) {
    return this.mailService.moveMessage(dto.messageId, dto.targetFolder);
  }
}
````

## File: src/exchange/services/mail.service.ts
````typescript
import { Injectable, Logger } from '@nestjs/common';
import { ImapMailProvider } from './imap-mail.provider';
import { MailMessage } from '../interfaces/mail-provider.interface';
import { SendMailDto } from '../dto/exchange.dto';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly provider: ImapMailProvider) {}

  private async withProvider<T>(operation: () => Promise<T>): Promise<T> {
      try {
          await this.provider.connect();
          return await operation();
      } catch (error) {
          this.logger.error(`Mail operation failed: ${error.message}`, error.stack);
          throw error;
      } finally {
          await this.provider.disconnect();
      }
  }

  async getFolders() {
      return this.withProvider(() => this.provider.getFolders());
  }

  async getMessages(folderType: string, page: number = 1, pageSize: number = 20) {
      // Map folderType to ID if needed, but provider expects ID.
      // Our provider "getFolders" returns IDs like 'INBOX', 'Sent Items'.
      // The frontend calls with 'inbox', 'sent', 'drafts', 'trash'.
      // We need to map these to the provider IDs.
      
      let folderId = 'INBOX';
      switch(folderType.toLowerCase()) {
          case 'inbox': folderId = 'INBOX'; break;
          case 'sent': folderId = 'Sent Items'; break;
          case 'drafts': folderId = 'Drafts'; break;
          case 'trash': folderId = 'Deleted Items'; break;
          case 'spam': folderId = 'Spam'; break;
          default: folderId = 'INBOX'; // Default fallthrough or specific handling
      }

      return this.withProvider(() => this.provider.getMessages(folderId, page, pageSize));
  }

  async getMessage(id: string) {
      return this.withProvider(() => this.provider.getMessage(id));
  }

  async sendMessage(dto: SendMailDto) {
      return this.withProvider(() => this.provider.sendMessage(dto));
  }
  
  async searchMessages(query: string, page: number = 1, pageSize: number = 20) {
      return this.withProvider(() => this.provider.search(query, page, pageSize));
  }

  async moveMessage(messageId: string, targetFolderType: string) {
      // Map folder type to actual folder ID
      let targetFolderId = 'INBOX';
      switch(targetFolderType.toLowerCase()) {
          case 'inbox': targetFolderId = 'INBOX'; break;
          case 'sent': targetFolderId = 'Sent Items'; break;
          case 'drafts': targetFolderId = 'Drafts'; break;
          case 'trash': targetFolderId = 'Deleted Items'; break;
          case 'spam': targetFolderId = 'Spam'; break;
          default: targetFolderId = targetFolderType; // Allow direct folder ID
      }

      return this.withProvider(() => this.provider.moveMessage(messageId, targetFolderId));
  }
}
````

## File: src/main.ts
````typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: (validationErrors) => {
        const errors = {};

        for (const err of validationErrors) {
          const field = err.property;
          const messages = Object.values(err.constraints || {});
          errors[field] = messages.length === 1 ? messages[0] : messages;
        }
        console.log('Validation Errors:', JSON.stringify(validationErrors, null, 2));
        return new BadRequestException({
          errors,
        });
      },
    }),
  );

  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
````

## File: src/auth/auth.service.ts
````typescript
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EntityManager } from '@mikro-orm/core';
import { User } from '../database/entities/user.entity';
import { AuditLogService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly em: EntityManager,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getMe(userId: string): Promise<User> {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại !');
    }
    return user;
  }
}
````

## File: src/exchange/dto/exchange.dto.ts
````typescript
import { IsString, IsEmail, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class ExchangeLoginDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class AttachmentDto {
    @IsString()
    @IsNotEmpty()
    filename!: string;

    @IsString()
    @IsOptional()
    contentType?: string;

    @IsString()
    @IsNotEmpty()
    content!: string; // Base64 encoded content
}

export class SendMailDto {
    @IsArray()
    @IsEmail({}, { 
        each: true,
        message: 'Thông tin người nhận không hợp lệ!'
    })
    to!: string[];

    @IsArray()
    @IsOptional()
    @IsEmail({}, { each: true, message: 'Thông tin CC không hợp lệ!' })
    cc?: string[];

    @IsArray()
    @IsOptional()
    @IsEmail({}, { each: true, message: 'Thông tin BCC không hợp lệ!' })
    bcc?: string[];

    @IsArray()
    @IsOptional()
    @IsEmail({}, { each: true, message: 'Thông tin Reply-To không hợp lệ!' })
    replyTo?: string[];

    @IsString()
    @IsNotEmpty({ message: 'Tiêu đề email không được để trống!' })
    subject!: string;

    @IsString()
    @IsOptional()
    text?: string; // Plain text version

    @IsString()
    @IsOptional()
    html?: string; // HTML version

    @IsArray()
    @IsOptional()
    attachments?: AttachmentDto[];
}

export class MoveMailDto {
    @IsString()
    @IsNotEmpty()
    messageId!: string;

    @IsString()
    @IsNotEmpty()
    targetFolder!: string;
}
````

## File: src/exchange/interfaces/mail-provider.interface.ts
````typescript
export interface MailMessage {
  id: string; // Composite ID: Base64(folder:uid)
  subject: string;
  from: { name: string; email: string };
  to: { name: string; email: string }[];
  cc: { name: string; email: string }[];
  receivedAt: Date;
  body: string;
  isHtml: boolean;
  hasAttachments: boolean;
  isRead: boolean;
  preview: string;
  importance?: string;
}

export interface MailFolder {
  id: string; // e.g., 'INBOX', 'Sent', 'Drafts'
  name: string;
}

export interface Attachment {
  filename: string;
  contentType?: string;
  content: string; // Base64 encoded
}

export interface SendMailOptions {
  from?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  subject: string;
  text?: string; // Plain text version
  html?: string; // HTML version
  attachments?: Attachment[];
}

export interface IMailProvider {
  /**
   * Connect to the mail server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the mail server
   */
  disconnect(): Promise<void>;

  /**
   * Get list of standard folders
   */
  getFolders(): Promise<MailFolder[]>;

  /**
   * Get messages from a folder with pagination
   */
  getMessages(
    folderId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }>;

  /**
   * Get a single message by its composite ID
   */
  getMessage(id: string): Promise<MailMessage>;

  /**
   * Send an email
   */
  sendMessage(
    options: SendMailOptions,
  ): Promise<{ success: boolean; messageId?: string }>;

  /**
   * Search messages
   */
  search(
    query: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }>;

  /**
   * Move message to another folder
   */
  moveMessage(
    messageId: string,
    targetFolder: string,
  ): Promise<{ success: boolean }>;
}
````

## File: mikro-orm.config.ts
````typescript
import 'dotenv/config'; // Ensure .env is loaded for CLI
import { defineConfig } from '@mikro-orm/postgresql';
import { User } from './src/database/entities/user.entity';
import { File } from './src/database/entities/file.entity';
import { AuditLog } from './src/database/entities/audit-log.entity';

export default defineConfig({
  entities: [User, File, AuditLog],
  dbName: process.env.DB_NAME || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  debug: process.env.NODE_ENV !== 'production',
  allowGlobalContext: process.env.DB_ALLOW_GLOBAL_CONTEXT === 'true', // CLI/Migration usage
  migrations: {
    path: './src/database/migrations',
    pathTs: './src/database/migrations',
  },
});
````

## File: src/exchange/services/imap-mail.provider.ts
````typescript
import {
  Injectable,
  Scope,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';
import * as nodemailer from 'nodemailer';
import * as mailparser from 'mailparser';
import {
  IMailProvider,
  MailFolder,
  MailMessage,
  SendMailOptions,
} from '../interfaces/mail-provider.interface';
import { ExchangeAuthService } from './exchange-auth.service';
import { safeStringify } from '../utils/json.helper';

@Injectable({ scope: Scope.REQUEST })
export class ImapMailProvider implements IMailProvider {
  private readonly logger = new Logger(ImapMailProvider.name);
  private client: ImapFlow;
  private transporter: nodemailer.Transporter;
  private credentials: { email: string; password: string };
  private sessionToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: ExchangeAuthService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getImapConfig() {
    const host = this.configService.get<string>(
      'IMAP_HOST',
      'outlook.office365.com',
    );
    const port = this.configService.get<number>('IMAP_PORT', 993);
    const secure = this.configService.get<boolean>('IMAP_SECURE', true);

    return {
      host,
      port,
      secure,
      auth: {
        user: this.credentials.email,
        pass: this.credentials.password,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      },
      logger: false,
    };
  }

  private getSmtpConfig() {
    const host = this.configService.get<string>(
      'SMTP_HOST',
      'smtp.office365.com',
    );
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);
    return {
      host,
      port,
      secure: false,
      requireTLS: true, // ⬅️ ĐỔI: Không bắt buộc TLS
      auth: {
        user: this.credentials.email,
        pass: this.credentials.password,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      },
      debug: true,
      logger: true,
    };
  }

  async connect(): Promise<void> {
    // Lấy session token từ cookie
    this.sessionToken = this.request.cookies?.['exchange_session'];

    if (!this.sessionToken) {
      throw new UnauthorizedException(
        'No session token provided. Please login first.',
      );
    }

    // Lấy credentials từ session
    const creds = await this.authService.getCredentials(this.sessionToken);

    if (!creds) {
      throw new UnauthorizedException(
        'Session expired or invalid. Please login again.',
      );
    }

    this.credentials = creds;

    // Kết nối IMAP
    this.client = new ImapFlow(this.getImapConfig() as any);
    await this.client.connect();
    this.logger.log(`IMAP connected for ${this.credentials.email}`);

    // Khởi tạo SMTP transporter
    this.transporter = nodemailer.createTransport(this.getSmtpConfig() as any);
    try {
      await this.transporter.verify();
      this.logger.log(`SMTP verified for ${this.credentials.email}`);
    } catch (error) {
      this.logger.error(`SMTP verification failed: ${error.message}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
        this.logger.log('IMAP disconnected');
      } catch (error) {
        this.logger.warn(`Error disconnecting IMAP: ${error.message}`);
      }
    }
  }

  private encodeId(folder: string, uid: string): string {
    return Buffer.from(`${folder}:${uid}`).toString('base64');
  }

  private decodeId(id: string): { folder: string; uid: string } {
    const decoded = Buffer.from(id, 'base64').toString('utf8');
    const [folder, uid] = decoded.split(':');
    return { folder, uid };
  }

  async getFolders(): Promise<MailFolder[]> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    try {
      const list = await this.client.list();

      // Map standard folders
      const folderMap: Record<string, string> = {
        INBOX: 'Hộp thư đến',
        'Sent Items': 'Đã gửi',
        Drafts: 'Thư nháp',
        Spam: 'Thùng rác',
        'Junk Email': 'Thư rác',
      };

      const standardFolders = ['INBOX', 'Sent Items', 'Drafts', 'Spam'];
      const folders: MailFolder[] = [];

      for (const folderName of standardFolders) {
        const exists = list.some(
          (f) =>
            f.path === folderName ||
            f.path.toLowerCase() === folderName.toLowerCase(),
        );

        if (exists) {
          folders.push({
            id: folderName,
            name: folderMap[folderName] || folderName,
          });
        }
      }

      return folders;
    } catch (error) {
      this.logger.error(`Error fetching folders: ${error.message}`);
      throw error;
    }
  }

  async getMessages(
    folderId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const lock = await this.client.getMailboxLock(folderId);
    try {
      const status = await this.client.status(folderId, { messages: true });
      const total = status.messages || 0;

      if (total === 0) {
        return { items: [], total: 0 };
      }

      // Tính toán range cho pagination (newest first)
      const to = Math.max(1, total - (page - 1) * limit);
      const from = Math.max(1, to - limit + 1);

      if (to < 1) {
        return { items: [], total };
      }

      const seqRange = `${from}:${to}`;

      // Fetch messages
      const messages: any[] = [];
      for await (const msg of this.client.fetch(seqRange, {
        envelope: true,
        internalDate: true,
        bodyStructure: true,
        flags: true,
        uid: true,
      })) {
        messages.push(msg);
      }

      // Reverse để hiển thị mới nhất trước
      messages.reverse();

      const items = messages.map((msg) => ({
        id: this.encodeId(folderId, msg.uid.toString()),
        subject: msg.envelope.subject || '(No Subject)',
        from: msg.envelope.from
          ? this.mapAddress(msg.envelope.from[0])
          : { name: '', email: '' },
        receivedAt: msg.internalDate,
        isRead: msg.flags.has('\\Seen'),
        hasAttachments: this.checkAttachments(msg.bodyStructure),
        preview: '', // Skip preview for performance
      }));

      return { items, total };
    } catch (error) {
      this.logger.error(
        `Error fetching messages from ${folderId}: ${error.message}`,
      );
      throw error;
    } finally {
      lock.release();
    }
  }

  private mapAddress(addr: any): { name: string; email: string } {
    return {
      name: addr.name || '',
      email: addr.address || '',
    };
  }

  private checkAttachments(struct: any): boolean {
    if (!struct) return false;

    if (struct.childNodes) {
      return struct.childNodes.some(
        (node: any) =>
          node.disposition === 'attachment' ||
          (node.parameters && node.parameters.name),
      );
    }

    return false;
  }

  async getMessage(id: string): Promise<MailMessage> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const { folder, uid } = this.decodeId(id);
    const lock = await this.client.getMailboxLock(folder);

    try {
      // Fetch message
      const msg = await this.client.fetchOne(
        uid,
        { source: true, flags: true, uid: true },
        { uid: true },
      );

      if (!msg) {
        throw new Error('Message not found');
      }

      // Mark as read if not already
      if (msg.flags && !msg.flags.has('\\Seen')) {
        await this.client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      }

      if (!msg.source) {
        throw new Error('Message source not available');
      }

      // Parse email
      const parsed: any = await mailparser.simpleParser(msg.source);

      return {
        id: id,
        subject: parsed.subject || '(No Subject)',
        from: parsed.from?.value?.[0]
          ? {
              name: parsed.from.value[0].name || '',
              email: parsed.from.value[0].address || '',
            }
          : { name: '', email: '' },
        to: this.parseAddressList(parsed.to),
        cc: this.parseAddressList(parsed.cc),
        receivedAt: parsed.date || new Date(),
        body: parsed.html || parsed.textAsHtml || parsed.text || '',
        isHtml: !!parsed.html,
        hasAttachments: parsed.attachments && parsed.attachments.length > 0,
        isRead: true,
        preview: parsed.text ? parsed.text.substring(0, 100) : '',
      };
    } catch (error) {
      this.logger.error(`Error fetching message ${id}: ${error.message}`);
      throw error;
    } finally {
      lock.release();
    }
  }

  private parseAddressList(
    addressData: any,
  ): { name: string; email: string }[] {
    if (!addressData) return [];

    if (Array.isArray(addressData)) {
      return addressData.map((addr: any) => ({
        name: addr.name || '',
        email: addr.address || '',
      }));
    }

    if (addressData.value && Array.isArray(addressData.value)) {
      return addressData.value.map((addr: any) => ({
        name: addr.name || '',
        email: addr.address || '',
      }));
    }

    return [];
  }

  async sendMessage(
    options: SendMailOptions,
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.transporter) {
      throw new Error('Transporter not initialized. Call connect() first.');
    }

    if (!this.client) {
      throw new Error('IMAP client not connected. Call connect() first.');
    }

    try {
      // Build attachments array if provided
      const attachments = options.attachments?.map((att) => ({
        filename: att.filename,
        contentType: att.contentType,
        content: Buffer.from(att.content, 'base64'),
      }));

      const mailOptions = {
        from: this.credentials.email,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments,
      };

      // Send email via SMTP
      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully. MessageId: ${info.messageId}`);

      // Append to Sent Items folder using IMAP
      this.appendToSentFolder(mailOptions,info.messageId)
        .then(() => {
          this.logger.log(`Email appended to Sent Items folder`);
        })
        .catch((err) => {
          this.logger.warn(
            `Failed to append email to Sent Items: ${err.message}`,
          );
        });

      return {
        success: !!info.messageId,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`);
      throw error;
    }
  }

    private buildRFC822Message(mailOptions: any, messageId: string): string {
    const lines: string[] = [];

    // Headers
    lines.push(`Message-ID: ${messageId}`);
    lines.push(`Date: ${new Date().toUTCString()}`);
    lines.push(`From: ${mailOptions.from}`);
    
    if (mailOptions.to) {
      const toAddresses = Array.isArray(mailOptions.to)
        ? mailOptions.to.join(', ')
        : mailOptions.to;
      lines.push(`To: ${toAddresses}`);
    }

    if (mailOptions.cc) {
      const ccAddresses = Array.isArray(mailOptions.cc)
        ? mailOptions.cc.join(', ')
        : mailOptions.cc;
      lines.push(`Cc: ${ccAddresses}`);
    }

    if (mailOptions.replyTo) {
      lines.push(`Reply-To: ${mailOptions.replyTo}`);
    }

    lines.push(`Subject: ${mailOptions.subject || '(No Subject)'}`);
    lines.push(`MIME-Version: 1.0`);

    // Handle multipart message (HTML + text or with attachments)
    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      lines.push('');
      
      // Text/HTML part
      lines.push(`--${boundary}`);
      if (mailOptions.html) {
        lines.push(`Content-Type: text/html; charset=utf-8`);
        lines.push(`Content-Transfer-Encoding: quoted-printable`);
        lines.push('');
        lines.push(mailOptions.html);
      } else if (mailOptions.text) {
        lines.push(`Content-Type: text/plain; charset=utf-8`);
        lines.push(`Content-Transfer-Encoding: quoted-printable`);
        lines.push('');
        lines.push(mailOptions.text);
      }

      // Attachments
      for (const att of mailOptions.attachments) {
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${att.contentType || 'application/octet-stream'}`);
        lines.push(`Content-Transfer-Encoding: base64`);
        lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        lines.push('');
        lines.push(att.content.toString('base64'));
      }

      lines.push(`--${boundary}--`);
    } else if (mailOptions.html) {
      // HTML only
      lines.push(`Content-Type: text/html; charset=utf-8`);
      lines.push(`Content-Transfer-Encoding: quoted-printable`);
      lines.push('');
      lines.push(mailOptions.html);
    } else {
      // Plain text only
      lines.push(`Content-Type: text/plain; charset=utf-8`);
      lines.push(`Content-Transfer-Encoding: quoted-printable`);
      lines.push('');
      lines.push(mailOptions.text || '');
    }

    return lines.join('\r\n');
  }

  /**
   * Append sent email to Sent Items folder using IMAP APPEND
   */
  private async appendToSentFolder(mailOptions: any, messageId: string): Promise<void> {
    // Find the Sent Items folder
    const sentData = this.buildRFC822Message(mailOptions, messageId);
    const sentFolder = 'Sent Items';

    try {
      // Append message to Sent Items
      await this.client.append(sentFolder, sentData, ['\Seen'], new Date());
      this.logger.log(`Successfully appended message to ${sentFolder}`);
    } catch (error) {
      this.logger.error(`Error appending to ${sentFolder}: ${error.message}`);
      throw error;
    }
  }

  async search(
    query: string,
    page: number,
    limit: number,
  ): Promise<{ items: Partial<MailMessage>[]; total: number }> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const folderId = 'INBOX';
    const lock = await this.client.getMailboxLock(folderId);

    try {
      // IMAP SEARCH
      const searchCriteria = {
        or: [
          { header: { key: 'subject', value: query } },
          { header: { key: 'from', value: query } },
          { body: query },
        ],
      };

      const uids = await this.client.search(searchCriteria, { uid: true });

      if (!uids || uids.length === 0) {
        return { items: [], total: 0 };
      }

      const total = uids.length;

      // Pagination (newest first)
      uids.reverse();
      const slicedUids = uids.slice((page - 1) * limit, page * limit);

      if (slicedUids.length === 0) {
        return { items: [], total };
      }

      // Fetch messages
      const messages: any[] = [];
      const uidSet = slicedUids.join(',');

      for await (const msg of this.client.fetch(
        uidSet,
        { envelope: true, internalDate: true, uid: true, flags: true },
        { uid: true },
      )) {
        messages.push(msg);
      }

      const items = messages.map((msg) => ({
        id: this.encodeId(folderId, msg.uid.toString()),
        subject: msg.envelope.subject || '(No Subject)',
        from: msg.envelope.from
          ? this.mapAddress(msg.envelope.from[0])
          : { name: '', email: '' },
        receivedAt: msg.internalDate,
        isRead: msg.flags.has('\\Seen'),
        hasAttachments: false, // Skip for search results performance
      }));

      // Sort by date descending
      items.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

      return { items, total };
    } catch (error) {
      this.logger.error(`Error searching messages: ${error.message}`);
      throw error;
    } finally {
      lock.release();
    }
  }

  /**
   * Move message to another folder using IMAP MOVE
   */
  async moveMessage(
    messageId: string,
    targetFolder: string,
  ): Promise<{ success: boolean }> {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }

    try {
      // Decode message ID to get source folder and UID
      const { folder: sourceFolder, uid } = this.decodeId(messageId);

      this.logger.log(
        `Moving message UID ${uid} from ${sourceFolder} to ${targetFolder}`,
      );

      // Get lock on source folder
      const lock = await this.client.getMailboxLock(sourceFolder);

      try {
        // Use native IMAP MOVE command
        const result = await this.client.messageMove(
          uid,
          targetFolder,
          { uid: true },
        );

        this.logger.log(
          `Successfully moved message to ${targetFolder}. Result: ${safeStringify(result)}`,
        );

        return { success: true };
      } finally {
        lock.release();
      }
    } catch (error) {
      this.logger.error(`Error moving message: ${error.message}`);
      throw error;
    }
  }
}
````

## File: package.json
````json
{
  "name": "nestjs-base-be",
  "version": "0.0.1",
  "description": "",
  "author": "",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "migration:create": "mikro-orm migration:create",
    "migration:up": "mikro-orm migration:up",
    "migration:down": "mikro-orm migration:down"
  },
  "dependencies": {
    "@mikro-orm/core": "^6.6.4",
    "@mikro-orm/nestjs": "^6.1.1",
    "@mikro-orm/postgresql": "^6.6.4",
    "@nestjs/common": "^11.0.1",
    "@nestjs/config": "^4.0.2",
    "@nestjs/core": "^11.0.1",
    "@nestjs/jwt": "^11.0.2",
    "@nestjs/mapped-types": "^2.1.0",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/schedule": "^6.1.0",
    "argon2": "^0.44.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.3",
    "cookie-parser": "^1.4.7",
    "imapflow": "^1.2.8",
    "ioredis": "^5.9.2",
    "mailparser": "^3.9.3",
    "nodemailer": "^7.0.13",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "ulid": "^3.0.2"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.2.0",
    "@eslint/js": "^9.18.0",
    "@mikro-orm/cli": "^6.6.4",
    "@mikro-orm/migrations": "^6.6.4",
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.1",
    "@types/cookie-parser": "^1.4.10",
    "@types/express": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/mailparser": "^3.4.6",
    "@types/multer": "^2.0.0",
    "@types/node": "^22.10.7",
    "@types/nodemailer": "^7.0.9",
    "@types/passport-jwt": "^4.0.1",
    "@types/supertest": "^6.0.2",
    "eslint": "^9.18.0",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-prettier": "^5.2.2",
    "globals": "^16.0.0",
    "jest": "^30.0.0",
    "prettier": "^3.4.2",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.20.0"
  },
  "jest": {
    "moduleFileExtensions": [
      "js",
      "json",
      "ts"
    ],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
````

## File: src/app.module.ts
````typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import queryConfig from './config/query.config';
import storageConfig from './config/storage.config';
import { MetaModule } from './meta/meta.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { User } from './database/entities/user.entity';
import { File } from './database/entities/file.entity';
import { AuditLog } from './database/entities/audit-log.entity';
import { AuditLogModule } from './audit/audit.module';
import { ExchangeModule } from './exchange/exchange.module';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, queryConfig, storageConfig],
    }),
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        driver: PostgreSqlDriver,
        entities: [User, File, AuditLog],
        dbName: configService.get<string>('database.name'),
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        user: configService.get<string>('database.user'),
        password: configService.get<string>('database.password'),
        debug: configService.get<string>('NODE_ENV') !== 'production',
        allowGlobalContext: configService.get<boolean>('database.allowGlobalContext'),
        migrations: {
            path: './src/database/migrations',
            pathTs: './src/database/migrations',
        },
      }),
      inject: [ConfigService],
    }),
    MetaModule,
    CommonModule,
    AuthModule,
    FilesModule,
    AuditLogModule,
    ExchangeModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
````
