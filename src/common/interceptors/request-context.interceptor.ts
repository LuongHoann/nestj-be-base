import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Scope,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContext } from '../context/request.context';

@Injectable({ scope: Scope.REQUEST })
export class RequestContextInterceptor implements NestInterceptor {
  constructor(@Inject(RequestContext) private readonly requestContext: RequestContext) {
    console.log('🏗️ RequestContextInterceptor created, requestContext:', !!this.requestContext);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // ✅ Sau khi JwtStrategy validate, gắn user từ request.user vào RequestContext
    if (request.user) {
      this.requestContext.user = request.user;
    }

    return next.handle();
  }
}