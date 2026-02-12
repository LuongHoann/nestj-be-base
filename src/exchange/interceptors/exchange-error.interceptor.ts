import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ExchangeErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError(err => {
        if (err instanceof HttpException) {
          return throwError(() => err);
        }

        // Map EWS errors to HTTP Status
        // err.name or err.message often contains the code
        const msg = err.message || '';
        
        if (
            msg.includes('ErrorInvalidCredentials') ||
            msg.includes('401') ||
            msg.includes('No session token') ||
            msg.includes('Session expired or invalid')
        ) {
            return throwError(() => new HttpException('Sai thông tin đăng nhập Exchange', 401));
        }
        if (msg.includes('AccountIsLocked') || msg.includes('ErrorImpersonationDenied')) {
            return throwError(() => new HttpException('Tài khoản bị khóa hoặc không có quyền truy cập', 403));
        }
        if (msg.includes('ErrorServerBusy')) {
            return throwError(() => new HttpException('Máy chủ đang bận, vui lòng thử lại sau', 429));
        }
         if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
            return throwError(() => new HttpException('Mất kết nối đến Exchange Server', 504));
        }

        // Default
        Logger.error(`EWS Error: ${msg}`, err.stack);
        return throwError(() => new HttpException('Lỗi kết nối Exchange Webmail', 500));
      }),
    );
  }
}
