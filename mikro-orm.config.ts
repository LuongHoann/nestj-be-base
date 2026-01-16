import { defineConfig } from '@mikro-orm/postgresql';
import { User } from './src/database/entities/user.entity';
import { Post } from './src/database/entities/post.entity';
import { Comment } from './src/database/entities/comment.entity';
import { Role } from './src/database/entities/role.entity';
import { Permission } from './src/database/entities/permission.entity';

export default defineConfig({
  entities: [User, Post, Comment, Role, Permission],
  dbName: 'postgres',
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '123', // Replace with env vars in real app
  debug: true,
  allowGlobalContext: true, // simplified for this demo, ideally false
  migrations: {
    path: './src/database/migrations',
    pathTs: './src/database/migrations',
  },
});
