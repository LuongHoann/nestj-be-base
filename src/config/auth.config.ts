import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET || 'secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '7d',
  maxFailedRefreshInfo: parseInt(process.env.AUTH_MAX_FAILED_REFRESH || '5', 10),
  logLevel: process.env.AUTH_LOG_LEVEL || 'basic',
}));
