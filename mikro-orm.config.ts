import 'dotenv/config'; // Ensure .env is loaded for CLI
import { defineConfig } from '@mikro-orm/postgresql';
import { User } from './src/database/entities/user.entity';
import { Post } from './src/database/entities/post.entity';
import { Comment } from './src/database/entities/comment.entity';
import { Role } from './src/database/entities/role.entity';
import { Permission } from './src/database/entities/permission.entity';
import { RefreshToken } from './src/database/entities/refresh-token.entity';
import { ResetPasswordToken } from './src/database/entities/reset-password-token.entity';
import { File } from './src/database/entities/file.entity';

export default defineConfig({
  entities: [User, Post, Comment, Role, Permission, RefreshToken, ResetPasswordToken, File],
  dbName: process.env.DB_NAME || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  debug: process.env.NODE_ENV !== 'production',
  allowGlobalContext: process.env.DB_ALLOW_GLOBAL_CONTEXT === 'true', // CLI/Migration usage
  migrations: {
    path: './src/database/migrations',
    pathTs: './src/database/migrations',
  },
});
