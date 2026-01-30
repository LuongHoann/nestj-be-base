import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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
    
    const options = await this.queryEngine.parseAndCompile({
      collection,
      query,
    });
    // Check if meta is requested
    const hasMeta = options.meta && (options.meta.filter_count || options.meta.total_count);
    if (!hasMeta) {
      // No meta requested - return data directly (backward compatible)
      const data = await this.repository.find(collection, options);
      return data;
    }
    // Optimize: Use findAndCount when filter_count is needed
    // This gets both data and filter_count in a single query
    let data: any[];
    let filterCount: number | undefined;
    if (options.meta.filter_count) {
      // Single optimized query for data + filter_count
      [data, filterCount] = await this.repository.findAndCount(collection, options);
    } else {
      // Only total_count needed, use regular find
      data = await this.repository.find(collection, options);
    }
    // Build meta object with only requested fields
    const meta: any = {};
    if (options.meta.filter_count) {
      meta.filter_count = filterCount;
    }
    if (options.meta.total_count) {
      // Separate query for total count (no filters)
      meta.total_count = await this.repository.count(collection, {});
    }
    // Return structured response
    return {
      data,
      meta,
    };
  }

  async findOne(collection: string, id: string | number, query: any) {
    this.validateCollection(collection);
    
    // The query engine is responsible for applying 'read' permission filters (row-level security)
    // into the compiled 'where' clause.
    const options = await this.queryEngine.parseAndCompile({
        collection,
        query,
    });
    
    // Combine the query engine's WHERE clause (which includes permission filters) 
    // with the ID filter for this specific item.
    options.where = {
      $and: [options.where, { id }]
    };

    // Use find() with limit: 1 to ensure all filters (including permissions) are respected.
    const results = await this.repository.find(collection, { ...options, limit: 1 });

    if (results.length === 0) {
      // Using NotFoundException is standard. It prevents leaking information about
      // whether the resource exists but is forbidden, or truly does not exist.
      throw new NotFoundException(
        `Item ${id} in ${collection} not found or permission denied`,
      );
    }

    return results[0];
  }

  async create(collection: string, data: any) {
     this.validateCollection(collection);
    await this.permissionService.assert(collection, 'create');
    return this.repository.create(collection, data);
  }

  async update(collection: string, id: string | number, data: any) {
     this.validateCollection(collection);
    await this.permissionService.assert(collection, 'update');
    // TODO: Row-level update permissions check?
    // Usually requires fetching the item first and checking if it meets criteria.
    return this.repository.update(collection, id, data);
  }

  async delete(collection: string, id: string | number) {
    this.validateCollection(collection);
    await this.permissionService.assert(collection, 'delete');
    return this.repository.delete(collection, id);
  }
}
