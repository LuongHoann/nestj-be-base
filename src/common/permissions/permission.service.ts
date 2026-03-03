import { ForbiddenException, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { RequestContext } from '../context/request.context';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class PermissionService {
  constructor(
    private readonly requestContext: RequestContext,
    private readonly em: EntityManager,
  ) {}

  private async loadUserWithPermissions(userId: string) {
    return this.em.findOne(
      User,
      { id: userId },
      {
        populate: ['roles', 'roles.permissions'],
      },
    );
  }

  async hasRole(roleName: string): Promise<boolean> {
    const user = this.requestContext.user;
    if (!user?.id) return false;

    const entity = await this.loadUserWithPermissions(String(user.id));
    if (!entity) return false;

    return entity.roles.getItems().some((role) => role.name === roleName);
  }

  async can(collection: string, action: string): Promise<any> {
    const user = this.requestContext.user;
    if (!user?.id) return false;

    const entity = await this.loadUserWithPermissions(String(user.id));
    if (!entity) return false;

    const roles = entity.roles.getItems();
    if (roles.some((role) => role.name === 'admin')) {
      return {};
    }

    const hasPermission = roles.some((role) =>
      role.permissions
        .getItems()
        .some(
          (permission) =>
            permission.collection === collection &&
            permission.action === action,
        ),
    );

    return hasPermission ? {} : false;
  }

  async assert(collection: string, action: string | string[]): Promise<void> {
    const actions = Array.isArray(action) ? action : [action];

    for (const item of actions) {
      const allowed = await this.can(collection, item);
      if (allowed === false) {
        throw new ForbiddenException(
          `Permission denied: ${item} on ${collection}`,
        );
      }
    }
  }
}
