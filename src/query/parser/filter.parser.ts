import { Injectable } from '@nestjs/common';
import { FilterNode, LogicalOperator } from '../ast/query.ast';
import { InvalidQueryException } from '../../common/exceptions/invalid-query.exception';

@Injectable()
export class FilterParser {
  parse(filter: any): FilterNode | null {
    if (!filter) return null;
    if (typeof filter === 'string') {
        try {
            filter = JSON.parse(filter);
        } catch (e) {
            throw new InvalidQueryException('Filter must be valid JSON');
        }
    }

    return this.parseNode(filter);
  }

  private parseNode(node: any): any {
    if (Object.keys(node).length === 0) return {};

    const result: any = {};

    for (const key of Object.keys(node)) {
      if (key === '_and' || key === '_or') {
        // Logical Operator
        if (!Array.isArray(node[key])) {
            throw new InvalidQueryException(`Logical operator ${key} must be an array`);
        }
        result[key] = node[key].map((child: any) => this.parseNode(child));
      } else {
        // Field or Operator or Nested Relation
        // We don't deeply validate fields here, we trust the structure is roughly correct
        // and validation happens at compile time or DB level to keep parser generic.
        result[key] = node[key];
      }
    }

    return result;
  }
}
