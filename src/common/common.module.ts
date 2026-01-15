import { Module, Global } from '@nestjs/common';
import { RequestContext } from './context/request.context';
import { PermissionService } from './permissions/permission.service';

@Global()
@Module({
  providers: [RequestContext, PermissionService],
  exports: [RequestContext, PermissionService],
})
export class CommonModule {}
