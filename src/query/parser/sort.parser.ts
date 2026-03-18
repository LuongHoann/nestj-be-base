import { Injectable } from '@nestjs/common';
import { SortNode } from '../ast/query.ast';

@Injectable()
export class SortParser {
  // sort=title,-createdAt
  parse(sort: string | string[]): SortNode[] {
    if (!sort) return [];
    
    const sortParams = Array.isArray(sort) ? sort : sort.split(',');
    
    return sortParams.map(param => {
      let direction: 'asc' | 'desc' = 'asc';
      let field = param.trim();

      if (field.startsWith('-')) {
        direction = 'desc';
        field = field.substring(1);
      }

      return { field, direction };
    });
  }
}
