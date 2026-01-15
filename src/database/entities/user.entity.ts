import { Entity, PrimaryKey, Property, OneToMany, Collection, Cascade } from '@mikro-orm/core';
import { Post } from './post.entity';
import { Comment } from './comment.entity';

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property({ unique: true })
  email!: string;

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();

  @OneToMany(() => Post, post => post.author, { cascade: [Cascade.ALL] })
  posts = new Collection<Post>(this);

  @OneToMany(() => Comment, comment => comment.author)
  comments = new Collection<Comment>(this);
}
