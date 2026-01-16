import { Entity, PrimaryKey, Property, OneToMany, ManyToMany, Collection, Cascade } from '@mikro-orm/core';
import { Post } from './post.entity';
import { Comment } from './comment.entity';
import { Role } from './role.entity';

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property({ unique: true })
  email!: string;

  /**
   * Hashed password for authentication
   * Should be hashed using bcrypt or similar before storage
   */
  @Property({ hidden: true }) // Hidden from serialization by default
  password!: string;

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();

  @OneToMany(() => Post, post => post.author, { cascade: [Cascade.ALL] })
  posts = new Collection<Post>(this);

  @OneToMany(() => Comment, comment => comment.author)
  comments = new Collection<Comment>(this);

  /**
   * Roles assigned to this user (many-to-many)
   * Managed via users_roles join table
   */
  @ManyToMany(() => Role, (role) => role.users, { owner: true })
  roles = new Collection<Role>(this);
}
