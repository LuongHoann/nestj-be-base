import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';
import { randomUUID } from 'crypto';

@Entity({ tableName: 'rss_feeds' })
export class RssFeed {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ unique: true })
  @Index()
  url!: string;

  @Property({ nullable: true })
  name?: string;

  @Property({ fieldName: 'title', nullable: true })
  legacyTitle?: string;

  @Property({ default: true })
  isActive: boolean = true;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
