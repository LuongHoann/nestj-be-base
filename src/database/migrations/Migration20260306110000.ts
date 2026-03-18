import { Migration } from '@mikro-orm/migrations';

export class Migration20260306110000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "rss_feeds" ("id" uuid not null default gen_random_uuid(), "url" varchar(255) not null, "name" varchar(255) null, "is_active" boolean not null default true, "created_at" timestamptz not null default current_timestamp, "updated_at" timestamptz not null default current_timestamp, constraint "rss_feeds_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "rss_feeds" add column if not exists "name" varchar(255) null;`,
    );
    this.addSql(
      `update "rss_feeds" set "name" = coalesce("name", "title", "url") where "name" is null;`,
    );
    this.addSql(
      `alter table "rss_feeds" add column if not exists "is_active" boolean not null default true;`,
    );
    this.addSql(
      `alter table "rss_feeds" add column if not exists "updated_at" timestamptz not null default current_timestamp;`,
    );
    this.addSql(
      `create index if not exists "rss_feeds_url_index" on "rss_feeds" ("url");`,
    );
    this.addSql(
      `do $$ begin if not exists (select 1 from pg_constraint where conname = 'rss_feeds_url_unique') then alter table "rss_feeds" add constraint "rss_feeds_url_unique" unique ("url"); end if; end $$;`,
    );

    this.addSql(
      `create table if not exists "rss_articles" ("id" uuid not null default gen_random_uuid(), "feed_id" uuid null, "guid" varchar(1024) null, "link" varchar(2048) null, "title" varchar(255) null, "summary" text not null default '', "is_read" boolean not null default false, "read_at" timestamptz null, "published_at" timestamptz null, "created_at" timestamptz not null default current_timestamp, "updated_at" timestamptz not null default current_timestamp, constraint "rss_articles_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "rss_articles" add column if not exists "summary" text;`,
    );
    this.addSql(
      `update "rss_articles" set "summary" = coalesce("summary", "content_snippet", '') where "summary" is null;`,
    );
    this.addSql(
      `alter table "rss_articles" alter column "summary" set default '';`,
    );
    this.addSql(
      `alter table "rss_articles" add column if not exists "is_read" boolean not null default false;`,
    );
    this.addSql(
      `alter table "rss_articles" add column if not exists "read_at" timestamptz null;`,
    );
    this.addSql(
      `alter table "rss_articles" add column if not exists "published_at" timestamptz null;`,
    );
    this.addSql(
      `update "rss_articles" set "published_at" = coalesce("published_at", "pub_date") where "published_at" is null;`,
    );
    this.addSql(
      `alter table "rss_articles" add column if not exists "updated_at" timestamptz not null default current_timestamp;`,
    );
    this.addSql(
      `update "rss_articles" set "updated_at" = coalesce("updated_at", "created_at") where "updated_at" is null;`,
    );
    this.addSql(
      `create index if not exists "rss_articles_feed_id_index" on "rss_articles" ("feed_id");`,
    );
    this.addSql(
      `do $$ begin if not exists (select 1 from pg_constraint where conname = 'rss_articles_guid_unique') then alter table "rss_articles" add constraint "rss_articles_guid_unique" unique ("guid"); end if; end $$;`,
    );
    this.addSql(
      `do $$ begin if not exists (select 1 from pg_constraint where conname = 'rss_articles_link_unique') then alter table "rss_articles" add constraint "rss_articles_link_unique" unique ("link"); end if; end $$;`,
    );
    this.addSql(
      `do $$ begin if not exists (select 1 from pg_constraint where conname = 'rss_articles_feed_id_foreign') then alter table "rss_articles" add constraint "rss_articles_feed_id_foreign" foreign key ("feed_id") references "rss_feeds" ("id") on update cascade on delete set null; end if; end $$;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "rss_articles" drop constraint "rss_articles_feed_id_foreign";`,
    );

    this.addSql(`drop table if exists "rss_articles" cascade;`);
    this.addSql(`drop table if exists "rss_feeds" cascade;`);
  }
}
