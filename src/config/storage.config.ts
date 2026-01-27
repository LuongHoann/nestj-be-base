import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  driver: process.env.STORAGE_DRIVER || 'local',
  path: process.env.FILE_STORAGE_PATH || './storage',
}));
