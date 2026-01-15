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
