import { Injectable } from '@nestjs/common';
import { DeepNode } from '../ast/query.ast';
import { FilterParser } from './filter.parser';
import { SortParser } from './sort.parser';

@Injectable()
export class DeepParser {
  constructor(
      private readonly filterParser: FilterParser,
      private readonly sortParser: SortParser,
  ) {}

  parse(deep: any): DeepNode {
    if (!deep) return {};
    // Expect deep to be an object: deep[comments][_filter][status]=active
    // In express/nestjs, qs might handle this object nesting.
    
    const result: DeepNode = {};

    for (const relation of Object.keys(deep)) {
      const relConfig = deep[relation];
      result[relation] = {};

      if (relConfig._filter) {
        const parsed = this.filterParser.parse(relConfig._filter);
        if (parsed) {
             result[relation]._filter = parsed;
        }
      }
      if (relConfig._sort) {
        result[relation]._sort = this.sortParser.parse(relConfig._sort);
      }
      if (relConfig._limit) {
        result[relation]._limit = parseInt(relConfig._limit, 10);
      }
      if (relConfig._offset) {
        result[relation]._offset = parseInt(relConfig._offset, 10);
      }
    }

    return result;
  }
}
