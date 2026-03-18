import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { User } from './user.entity';
import { RssFeed } from './rss-feed.entity';

@Entity({ tableName: 'user_rss_subscriptions' })
@Unique({ properties: ['user', 'feed'] })
export class UserRssSubscription {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user!: User;

  @ManyToOne(() => RssFeed, { fieldName: 'feed_id' })
  feed!: RssFeed;

  @Property({ fieldName: 'folder_name', nullable: true })
  folderName?: string;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt: Date = new Date();
}
