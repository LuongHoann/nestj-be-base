import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Enum } from '@mikro-orm/core';
import { User } from './user.entity';
import { Comment } from './comment.entity';

@Entity()
export class Post {
  @PrimaryKey()
  id!: number;

  @Property()
  title!: string;

  @Property({ type: 'text' })
  content!: string;

  @Property()
  status: string = 'draft';

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();

  @ManyToOne(() => User)
  author!: User;

  @OneToMany(() => Comment, comment => comment.post)
  comments = new Collection<Comment>(this);
}
