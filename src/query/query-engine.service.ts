import { Injectable } from '@nestjs/common';
import { FilterParser } from './parser/filter.parser';
import { SortParser } from './parser/sort.parser';
import { PaginationParser } from './parser/pagination.parser';
import { FieldsParser } from './parser/fields.parser';
import { DeepParser } from './parser/deep.parser';
import { MetaParser } from './parser/meta.parser';
import { WhereCompiler } from './compiler/where.compiler';
import { OrderCompiler } from './compiler/order.compiler';
import { FieldsCompiler } from './compiler/fields.compiler';
import { ParsedQuery, QueryContext } from './ast/query.ast';
import { PermissionService } from '../common/permissions/permission.service';

@Injectable()
export class QueryEngineService {
  constructor(
    private readonly filterParser: FilterParser,
    private readonly sortParser: SortParser,
    private readonly paginationParser: PaginationParser,
    private readonly fieldsParser: FieldsParser,
    private readonly deepParser: DeepParser,
    private readonly metaParser: MetaParser,
    private readonly whereCompiler: WhereCompiler,
    private readonly orderCompiler: OrderCompiler,
    private readonly fieldsCompiler: FieldsCompiler,
    private readonly permissionService: PermissionService,
  ) {}

  async parseAndCompile(context: QueryContext): Promise<any> {
    const { collection, query } = context;

    // 1. Permissions (Pre-flight check)
    // Get mandatory filters from permission service
    const permissionFilter = this.permissionService.can(collection, 'read');

    // 2. Parse Standard Params
    const parsed: ParsedQuery = {
      filter: this.filterParser.parse(query.filter) || {},
      sort: this.sortParser.parse(query.sort),
      pagination: this.paginationParser.parse(query),
      fields: this.fieldsParser.parse(query.fields),
      deep: this.deepParser.parse(query.deep),
      meta: this.metaParser.parse(query.meta),
    };

    // 3. Compile
    // Merge permission filter into user filter with AND
    const finalFilter = {
      _and: [
        parsed.filter,
        permissionFilter
      ]
    };
    
    // Clean up empty objects
    if (Object.keys(parsed.filter).length === 0 && Object.keys(permissionFilter).length === 0) {
        // If both empty, just {}
    }

    const where = this.whereCompiler.compile(finalFilter);
    const orderBy = this.orderCompiler.compile(parsed.sort);
    const populate = this.fieldsCompiler.compile(parsed.fields);

    // Deep merge deep params into populate?
    // For now, simpler implementation:
    // If we have deep params, we might need a specific populate strategy or loading strategy.
    
    return {
      where,
      orderBy,
      limit: parsed.pagination.limit,
      offset: parsed.pagination.offset,
      populate, // Basic population based on fields
      meta: parsed.meta, // Pass meta requirements to service layer
    };
  }
}
