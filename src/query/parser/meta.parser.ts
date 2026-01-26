import { Injectable, BadRequestException } from '@nestjs/common';
import { MetaNode } from '../ast/query.ast';

@Injectable()
export class MetaParser {
  parse(meta: string | string[]): MetaNode {
    if (!meta) {
      return {};
    }

    // Handle array or comma-separated string
    const metaValues = Array.isArray(meta) 
      ? meta 
      : meta.split(',').map(v => v.trim());

    const result: MetaNode = {};

    for (const value of metaValues) {
      if (value === '*') {
        // Wildcard: include all meta fields
        result.filter_count = true;
        result.total_count = true;
      } else if (value === 'filter_count') {
        result.filter_count = true;
      } else if (value === 'total_count') {
        result.total_count = true;
      } else if (value) {
        // Non-empty unsupported value
        throw new BadRequestException(
          `Invalid meta value: "${value}". Supported values: filter_count, total_count, *`
        );
      }
    }

    return result;
  }
}
