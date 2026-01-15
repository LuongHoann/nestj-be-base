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
