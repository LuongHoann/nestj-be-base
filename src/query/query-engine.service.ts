import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    private readonly configService: ConfigService,
  ) {}

  async parseAndCompile(context: QueryContext): Promise<any> {
    const { collection, query } = context;

    // 0. Safety Checks (Hardening)
    const maxDepth = this.configService.get<number>('query.maxDepth', 3);
    const maxConditions = this.configService.get<number>('query.maxConditions', 20);
    const maxSortFields = this.configService.get<number>('query.maxSortFields', 3);
    const allowRegex = this.configService.get<boolean>('query.allowRegex', false);

    // Check Sort Fields Limit
    if (query.sort) {
        const sortKeys = Object.keys(query.sort);
        if (sortKeys.length > maxSortFields) {
            throw new BadRequestException(`Exceeded maximum sort fields limit of ${maxSortFields}`);
        }
    }

    // Check Regex Safety
    if (!allowRegex) {
        // Simple recursive check or check stringified query for regex operators if feasible 
        // For now, checks will happen in parsers/compilers ideally, but here is a high level guard
        const queryStr = JSON.stringify(query.filter);
        if (queryStr.includes('"$regex"') || queryStr.includes('"$iregex"')) {
             throw new BadRequestException('Regex queries are disabled by configuration');
        }
    }

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

    // Validate Condition Count (Heuristic based on keys in compiled where)
    // This is rough approximation. For accurate count, we'd need to walk the 'where' object.
    const conditionCount = this.countConditions(where);
    if (conditionCount > maxConditions) {
        throw new BadRequestException(`Exceeded maximum query conditions limit of ${maxConditions}`);
    }

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

  private countConditions(where: any): number {
      if (!where || typeof where !== 'object') return 0;
      if (Array.isArray(where)) return where.reduce((acc, curr) => acc + this.countConditions(curr), 0);
      
      let count = 0;
      for (const key in where) {
          if (key.startsWith('$')) { // Operator
              count++;
          }
           count += this.countConditions(where[key]);
      }
      return count + (Object.keys(where).length > 0 ? 1 : 0); // Count specific field matches too
  }
}
