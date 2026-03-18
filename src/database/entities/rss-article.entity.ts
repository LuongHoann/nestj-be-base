import { Entity, PrimaryKey, Property, ManyToOne, Index } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { RssFeed } from './rss-feed.entity';

@Entity({ tableName: 'rss_articles' })
export class RssArticle {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => RssFeed, { nullable: true })
  @Index()
  feed?: RssFeed;

  @Index()
  @Property({ nullable: true, length: 1024, unique: true })
  guid?: string;

  @Index()
  @Property({ nullable: true, length: 2048, unique: true })
  link?: string;

  @Property({ nullable: true })
  title?: string;

  @Property({ type: 'text' })
  summary: string = '';

  @Property({ default: false })
  isRead: boolean = false;

  @Property({ nullable: true })
  readAt?: Date;

  @Property({ nullable: true })
  publishedAt?: Date;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
