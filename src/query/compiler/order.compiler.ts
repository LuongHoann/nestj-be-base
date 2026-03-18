import { Injectable } from '@nestjs/common';
import { SortNode } from '../ast/query.ast';

@Injectable()
export class OrderCompiler {
  compile(sort: SortNode[]): any {
    if (!sort || sort.length === 0) return {};

    const orderBy: any = {};
    for (const node of sort) {
      // Handle nested sort "author.name" -> { author: { name: 'asc' } }
      // But MikroORM orderBy simple array is { field: 'ASC' } or { 'rel.field': 'ASC' }
      
      // MikroORM supports { 'author.name': 'asc' }
      orderBy[node.field] = node.direction;
    }

    return orderBy;
  }
}
