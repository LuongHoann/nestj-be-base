import { Injectable, BadRequestException } from '@nestjs/common';
import { GenericRepository } from '../repository/generic.repository';
import { QueryEngineService } from '../query/query-engine.service';
import { PermissionService } from '../common/permissions/permission.service';
import { EntityRegistryService } from '../meta/entity-registry.service';

@Injectable()
export class ItemsService {
  constructor(
    private readonly repository: GenericRepository,
    private readonly queryEngine: QueryEngineService,
    private readonly permissionService: PermissionService,
    private readonly registry: EntityRegistryService,
  ) {}

  private validateCollection(collection: string) {
    if (!this.registry.hasCollection(collection)) {
      throw new BadRequestException(`Collection ${collection} does not exist`);
    }
  }

  async findMany(collection: string, query: any) {
    this.validateCollection(collection);
    
    // 1. Permission Check (Read) happens inside QueryEngine via PermissionService hook 
    // or we can call it here explicitly.
    // The QueryOption compilation needs permissions to generate the right WhereClause.
    // My architecture says QueryEngine orchestrates query compilation + permissions.
    
    const options = await this.queryEngine.parseAndCompile({
      collection,
      query,
    });

    return this.repository.find(collection, options);
  }

  async findOne(collection: string, id: string | number, query: any) {
    this.validateCollection(collection);
    
    // We treat findOne as a findMany with a specific ID filter + read permissions
    const options = await this.queryEngine.parseAndCompile({
        collection,
        query,
    });
    
    // We explicitly use findOne from repo but we use the populate options from the query engine.
    // Security note: We should also apply the WHERE clause from permissions!
    // But repo.findOne usually just takes ID.
    // If we want to strictly enforce row-level permissions on single item fetch,
    // we should validte the item matches the permission filters.
    // Or just use findMany with ID filter and limit 1.
    // For now, let's use check permissions explicitly or trust the generic Find.
    
    // Simple verification check:
    const permissionFilter = this.permissionService.can(collection, 'read');
    if (Object.keys(permissionFilter).length > 0) {
        // If there are row-level constraints, we MUST query with them.
        options.where = { ...options.where, id };
        // Use findMany to respect the where clause
        const results = await this.repository.find(collection, { ...options, limit: 1 });
        if (results.length === 0) {
            throw new BadRequestException('Not found or forbidden');
        }
        return results[0];
    }

    return this.repository.findOne(collection, id, { populate: options.populate });
  }

  async create(collection: string, data: any) {
    this.validateCollection(collection);
    this.permissionService.assert(collection, 'create');
    return this.repository.create(collection, data);
  }

  async update(collection: string, id: string | number, data: any) {
    this.validateCollection(collection);
    this.permissionService.assert(collection, 'update');
    // TODO: Row-level update permissions check?
    // Usually requires fetching the item first and checking if it meets criteria.
    return this.repository.update(collection, id, data);
  }

  async delete(collection: string, id: string | number) {
    this.validateCollection(collection);
    this.permissionService.assert(collection, 'delete');
    return this.repository.delete(collection, id);
  }
}
