import { defineConfig } from '@mikro-orm/postgresql';
import { User } from './entities/user.entity';
import { Post } from './entities/post.entity';
import { Comment } from './entities/comment.entity';

export default defineConfig({
  entities: [User, Post, Comment],
  dbName: 'nestjs_base_be',
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password', // Replace with env vars in real app
  debug: true,
  allowGlobalContext: true, // simplified for this demo, ideally false
});
