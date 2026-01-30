import { Module, Global } from '@nestjs/common';
import { RequestContext } from './context/request.context';
import { PermissionService } from './permissions/permission.service';

import { RequestContextInterceptor } from './interceptors/request-context.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Global()
@Module({
  providers: [
    RequestContext, 
    PermissionService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
  exports: [RequestContext, PermissionService],
})
export class CommonModule {}
