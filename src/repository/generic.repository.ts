import { Injectable, NotFoundException } from '@nestjs/common';
import { MikroORM, QueryOrderMap } from '@mikro-orm/core';
import { EntityRegistryService } from '../meta/entity-registry.service';

@Injectable()
export class GenericRepository {
  constructor(
    private readonly orm: MikroORM,
    private readonly registry: EntityRegistryService,
  ) {}

  private getRepo(collection: string) {
    const entityName = this.registry.getEntityName(collection);
    return this.orm.em.getRepository(entityName);
  }

  // READ - Uses generic options (from QueryEngine)
  async find(collection: string, options: { 
      where: any, 
      orderBy?: QueryOrderMap<any>, 
      limit?: number, 
      offset?: number, 
      populate?: string[] 
  }) {
    const repo = this.getRepo(collection);
    return repo.find(options.where, {
      orderBy: options.orderBy,
      limit: options.limit,
      offset: options.offset,
      populate: options.populate as any,
    });
  }

  async findOne(collection: string, id: string | number, options: { populate?: string[] } = {}) {
    const repo = this.getRepo(collection);
    const item = await repo.findOne(id, { populate: options.populate as any });
    if (!item) {
        throw new NotFoundException(`Item ${id} in ${collection} not found`);
    }
    return item;
  }

  async count(collection: string, where: any): Promise<number> {
    const repo = this.getRepo(collection);
    return repo.count(where);
  }

  // WRITE - Uses EntityManager
  async create(collection: string, data: any): Promise<any> {
    const entityName = this.registry.getEntityName(collection);
    const entity = this.orm.em.create(entityName, data);
    await this.orm.em.persistAndFlush(entity);
    return entity;
  }

  async update(collection: string, id: string | number, data: any): Promise<any> {
    const repo = this.getRepo(collection);
    const item = await repo.findOne(id);
    if (!item) {
      throw new NotFoundException();
    }
    this.orm.em.assign(item, data);
    await this.orm.em.persistAndFlush(item);
    return item;
  }

  async delete(collection: string, id: string | number): Promise<void> {
    const repo = this.getRepo(collection);
    const item = await repo.getReference(id);
    await this.orm.em.removeAndFlush(item);
  }
}
