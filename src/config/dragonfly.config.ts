import { registerAs } from '@nestjs/config';

export default registerAs('dragonfly', () => ({
  enabled: process.env.DRAGONFLY_ENABLED === 'true' || false,
  host: process.env.DRAGONFLY_HOST || 'localhost',
  port: parseInt(process.env.DRAGONFLY_PORT || '6379', 10),
  password: process.env.DRAGONFLY_PASSWORD || '',
  ttl: parseInt(process.env.DRAGONFLY_TTL || '300', 10), // Default 5 minutes
}));
