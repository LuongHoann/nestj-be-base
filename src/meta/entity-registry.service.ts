import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import { MikroORM, EntityMetadata } from '@mikro-orm/core';

@Injectable()
export class EntityRegistryService implements OnModuleInit {
  private readonly logger = new Logger(EntityRegistryService.name);
  private readonly collectionMap = new Map<string, string>(); // collectionName -> EntityClassName
  private readonly entityMap = new Map<string, EntityMetadata>(); // EntityClassName -> Metadata

  constructor(private readonly orm: MikroORM) {}

  async onModuleInit() {
    this.scanEntities();
  }

  private scanEntities() {
    const metadata = this.orm.getMetadata().getAll();
    for (const meta of Object.values(metadata)) {
      // Use tableName as the collection identifier
      const collectionName = meta.tableName;
      const entityName = meta.className;

      if (!collectionName) {
        continue;
      }

      this.collectionMap.set(collectionName, entityName);
      this.entityMap.set(entityName, meta);
      
      this.logger.log(`Registered collection: ${collectionName} -> ${entityName}`);
    }
  }

  getEntityName(collection: string): string {
    const entityName = this.collectionMap.get(collection);
    if (!entityName) {
      throw new NotFoundException(`Collection ${collection} not found`);
    }
    return entityName;
  }

  getMetadata(collection: string): EntityMetadata {
    const entityName = this.getEntityName(collection);
    return this.entityMap.get(entityName)!;
  }

  hasCollection(collection: string): boolean {
    return this.collectionMap.has(collection);
  }
}
