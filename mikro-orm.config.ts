import 'dotenv/config'; // Ensure .env is loaded for CLI
import { defineConfig } from '@mikro-orm/postgresql';
import { User } from './src/database/entities/user.entity';
import { File } from './src/database/entities/file.entity';
import { AuditLog } from './src/database/entities/audit-log.entity';
import { RssFeed } from './src/database/entities/rss-feed.entity';
import { RssArticle } from './src/database/entities/rss-article.entity';

export default defineConfig({
  entities: [User, File, AuditLog, RssFeed, RssArticle],
  dbName: process.env.DB_NAME || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  debug: process.env.NODE_ENV !== 'production',
  allowGlobalContext: process.env.DB_ALLOW_GLOBAL_CONTEXT === 'true', // CLI/Migration usage
  migrations: {
    path: './src/database/migrations',
    pathTs: './src/database/migrations',
  },
});
