import { Injectable } from '@nestjs/common';
import { PaginationNode } from '../ast/query.ast';

@Injectable()
export class PaginationParser {
  parse(query: any): PaginationNode {
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    const offset = query.offset ? parseInt(query.offset, 10) : undefined;
    const page = query.page ? parseInt(query.page, 10) : undefined;

    return { limit, offset, page };
  }
}
