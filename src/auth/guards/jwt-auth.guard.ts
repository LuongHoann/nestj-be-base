import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    if (err || !user) {
      console.log('🔴 [DEBUG] JwtAuthGuard Failure:');
      console.log('   Error:', err);
      console.log('   Info:', info?.message || info);
      let message = (info?.message || info).toLowerCase();
      if (message === 'jwt expired') {
        message = 'Token hết hạn vui lòng đăng nhập lại !';
      } else if (message === 'invalid signature' || message === 'jwt malformed' || message === 'no auth token') {
        message = 'Token không hợp lệ !';
      }
      throw err || new UnauthorizedException(message);
    }
    return user;
  }
}