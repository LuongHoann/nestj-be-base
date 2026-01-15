import { Injectable } from '@nestjs/common';
import { EntityMetadata, ReferenceKind } from '@mikro-orm/core';
import { EntityRegistryService } from './entity-registry.service';

@Injectable()
export class MetadataReaderService {
  constructor(private readonly registry: EntityRegistryService) {}

  getRelationType(collection: string, field: string): 'm:1' | '1:m' | 'm:n' | '1:1' | null {
    const meta = this.registry.getMetadata(collection);
    const prop = meta.properties[field] as any;
    
    if (!prop) return null;

    if (prop.reference === ReferenceKind.MANY_TO_ONE) return 'm:1';
    if (prop.reference === ReferenceKind.ONE_TO_MANY) return '1:m';
    if (prop.reference === ReferenceKind.MANY_TO_MANY) return 'm:n';
    if (prop.reference === ReferenceKind.ONE_TO_ONE) return '1:1';
    
    return null;
  }

  isRelation(collection: string, field: string): boolean {
    return this.getRelationType(collection, field) !== null;
  }

  getRelatedCollection(collection: string, field: string): string | null {
    const meta = this.registry.getMetadata(collection);
    const prop = meta.properties[field] as any;
    
    if (!prop || !prop.target) return null;

    // Resolve target entity metadata to get its table name
    // Note: MikroORM metadata target can be a function or string or class
    // We assume standard usage where the ORM has resolved it or we can resolve it via registry if needed
    // For now, let's treat it as the EntityName (className) and find the tableName from registry if possible
    // or relying on how MikroORM exposes it.
    
    // Actually, prop.targetMeta is the safest if populated
    if (prop.targetMeta) {
      return prop.targetMeta.tableName;
    }
    
    return null;
  }
}
