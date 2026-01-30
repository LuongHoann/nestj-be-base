import { Injectable, Scope } from '@nestjs/common';

export interface UserContext {
  id: string | number;
  role: string;
  email?: string;
  permissions?: any[];
}

@Injectable({ scope: Scope.REQUEST })
export class RequestContext {
  private _user: UserContext | null = null;
  private _tenantId: string | null = null;

  get user(): UserContext | null {
    return this._user;
  }

  set user(user: UserContext | null) {
    this._user = user;
  }

  
  get tenantId(): string | null {
    return this._tenantId;
  }

  set tenantId(id: string | null) {
    this._tenantId = id;
  }
}
