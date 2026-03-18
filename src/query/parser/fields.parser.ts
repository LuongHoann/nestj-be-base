import { Injectable } from '@nestjs/common';

@Injectable()
export class FieldsParser {
  // fields=*,author.name,comments.*
  parse(fields: string | string[]): string[] {
    if (!fields) return ['*'];
    
    if (Array.isArray(fields)) return fields;
    
    return fields.split(',').map(f => f.trim()).filter(f => f.length > 0);
  }
}
