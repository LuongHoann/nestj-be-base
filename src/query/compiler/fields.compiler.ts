import { Injectable } from '@nestjs/common';

@Injectable()
export class FieldsCompiler {
  compile(fields: string[]): any {
    // fields=['*', 'author.name', 'comments.*']
    // MikroORM needs "populate" array.
    // We assume explicit fields selection logic.
    // If fields=['*'], populate nothing? Or populate all? 
    // Directus lazy loads nothing by default unless requested.
    
    // We simply extract relations from fields to populate them.
    // 'author.name' -> populate 'author'
    // 'comments.*' -> populate 'comments'
    
    const populate = new Set<string>();
    
    for (const f of fields) {
      if (f.includes('.')) {
        const parts = f.split('.');
        populate.add(parts[0]);
        // Support 2 levels? parts[0] + '.' + parts[1]
      }
    }

    return Array.from(populate);
  }
}
