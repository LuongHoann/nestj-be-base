import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { User } from './user.entity';
import { Post } from './post.entity';

@Entity({ tableName: 'comments' })
export class Comment {
  @PrimaryKey()
  id!: number;

  @Property({ type: 'text' })
  body!: string;

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @ManyToOne(() => User)
  author!: User;

  @ManyToOne(() => Post)
  post!: Post;
}
