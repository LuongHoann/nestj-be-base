import { Module, Global } from '@nestjs/common';
import { RequestContext } from './context/request.context';
import { RequestContextInterceptor } from './interceptors/request-context.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DragonflyService } from './cache/dragonfly.service';
import { CacheModule } from './cache/cache.module';
import { PermissionService } from './permissions/permission.service';

@Global()
@Module({
  imports: [CacheModule],
  providers: [
    RequestContext,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
    PermissionService,
  ],
  exports: [RequestContext, CacheModule, PermissionService],
})
export class CommonModule {}
