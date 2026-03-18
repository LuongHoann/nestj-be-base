import { Injectable } from '@nestjs/common';
import { FilterNode, FilterOperator } from '../ast/query.ast';

@Injectable()
export class WhereCompiler {
  compile(filter: FilterNode): any {
    if (!filter || Object.keys(filter).length === 0) return {};

    const where: any = {};

    for (const key of Object.keys(filter)) {
      if (key === '_and') {
        where['$and'] = (filter[key] as any[]).map(f => this.compile(f));
      } else if (key === '_or') {
        where['$or'] = (filter[key] as any[]).map(f => this.compile(f));
      } else {
        // Field or Relation
        const value = filter[key];
        if (this.isOperatorObject(value)) {
          where[key] = this.compileOperators(value);
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Nested relation filter (join)
            // MikroORM handles nested object keys as joins automatically if relation exists
            // { author: { name: { _eq: 'John' } } }
            where[key] = this.compile(value);
        } else {
            // Implicit _eq
            where[key] = value;
        }
      }
    }

    return where;
  }

  private isOperatorObject(obj: any): boolean {
    if (typeof obj !== 'object' || obj === null) return false;
    const keys = Object.keys(obj);
    // Simple check: starts with _
    return keys.some(k => k.startsWith('_'));
  }

  private compileOperators(ops: any): any {
    const result: any = {};
    for (const op of Object.keys(ops)) {
      const val = ops[op];
      switch (op as FilterOperator) {
        case '_eq': result['$eq'] = val; break;
        case '_neq': result['$ne'] = val; break;
        case '_gt': result['$gt'] = val; break;
        case '_gte': result['$gte'] = val; break;
        case '_lt': result['$lt'] = val; break;
        case '_lte': result['$lte'] = val; break;
        case '_in': result['$in'] = val; break;
        case '_nin': result['$nin'] = val; break;
        case '_contains': result['$like'] = `%${val}%`; break;
        case '_starts_with': result['$like'] = `${val}%`; break;
        // ... mapped others
        default: break;
      }
    }
    return result;
  }
}
