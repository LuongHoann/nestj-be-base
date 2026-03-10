import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { User } from './user.entity';
import { RssArticle } from './rss-article.entity';

@Entity({ tableName: 'user_rss_states' })
@Unique({ properties: ['user', 'article'] })
export class UserRssState {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user!: User;

  @ManyToOne(() => RssArticle, { fieldName: 'article_id' })
  article!: RssArticle;

  @Property({ fieldName: 'is_read', default: false })
  isRead: boolean = false;

  @Property({ fieldName: 'is_starred', default: false })
  isStarred: boolean = false;

  @Property({ fieldName: 'updated_at', onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
