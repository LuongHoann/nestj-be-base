import { registerAs } from '@nestjs/config';

export default registerAs('query', () => ({
  maxDepth: parseInt(process.env.QUERY_MAX_DEPTH || '3', 10),
  maxConditions: parseInt(process.env.QUERY_MAX_CONDITIONS || '20', 10),
  maxSortFields: parseInt(process.env.QUERY_MAX_SORT_FIELDS || '3', 10),
  allowRegex: process.env.QUERY_ALLOW_REGEX === 'true',
}));
