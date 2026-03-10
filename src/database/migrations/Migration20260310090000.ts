import { Migration } from '@mikro-orm/migrations';

export class Migration20260310090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "user_rss_subscriptions" ("id" uuid not null default gen_random_uuid(), "user_id" varchar(255) not null, "feed_id" uuid not null, "folder_name" varchar(255) null, "created_at" timestamptz not null default current_timestamp, constraint "user_rss_subscriptions_pkey" primary key ("id"));`,
    );
    this.addSql(
      `do $$ begin if not exists (select 1 from pg_constraint where conname = 'user_rss_subscriptions_user_id_feed_id_key') then alter table "user_rss_subscriptions" add constraint "user_rss_subscriptions_user_id_feed_id_key" unique ("user_id", "feed_id"); end if; end $$;`,
    );
    this.addSql(
      `do $$ begin if not exists (select 1 from pg_constraint where conname = 'user_rss_subscriptions_user_id_fkey') then alter table "user_rss_subscriptions" add constraint "user_rss_subscriptions_user_id_fkey" foreign key ("user_id") references "users" ("id") on delete cascade; end if; end $$;`,
    );
    this.addSql(
      `do $$ begin if not exists (select 1 from pg_constraint where conname = 'user_rss_subscriptions_feed_id_fkey') then alter table "user_rss_subscriptions" add constraint "user_rss_subscriptions_feed_id_fkey" foreign key ("feed_id") references "rss_feeds" ("id") on delete cascade; end if; end $$;`,
    );

    this.addSql(
      `create table if not exists "user_rss_states" ("id" uuid not null default gen_random_uuid(), "user_id" varchar(255) not null, "article_id" uuid not null, "is_read" boolean not null default false, "is_starred" boolean not null default false, "updated_at" timestamptz not null default current_timestamp, constraint "user_rss_states_pkey" primary key ("id"));`,
    );
    this.addSql(
      `do $$ begin if not exists (select 1 from pg_constraint where conname = 'user_rss_states_user_id_article_id_key') then alter table "user_rss_states" add constraint "user_rss_states_user_id_article_id_key" unique ("user_id", "article_id"); end if; end $$;`,
    );
    this.addSql(
      `do $$ begin if not exists (select 1 from pg_constraint where conname = 'user_rss_states_user_id_fkey') then alter table "user_rss_states" add constraint "user_rss_states_user_id_fkey" foreign key ("user_id") references "users" ("id") on delete cascade; end if; end $$;`,
    );
    this.addSql(
      `do $$ begin if not exists (select 1 from pg_constraint where conname = 'user_rss_states_article_id_fkey') then alter table "user_rss_states" add constraint "user_rss_states_article_id_fkey" foreign key ("article_id") references "rss_articles" ("id") on delete cascade; end if; end $$;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "user_rss_states" cascade;`);
    this.addSql(`drop table if exists "user_rss_subscriptions" cascade;`);
  }
}
