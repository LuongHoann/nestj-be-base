import { Migration } from '@mikro-orm/migrations';

export class Migration20260124030806 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "files" ("id" uuid not null default gen_random_uuid(), "original_name" varchar(255) not null, "stored_name" varchar(255) not null, "mime_type" varchar(255) not null, "size" bigint not null, "storage_path" varchar(255) not null, "status" text check ("status" in ('TEMP', 'ACTIVE', 'DELETED')) not null default 'TEMP', "custom_metadata" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "files_pkey" primary key ("id"));`);
    this.addSql(`create index "files_status_index" on "files" ("status");`);

    this.addSql(`alter table "reset_password_tokens" drop constraint "reset_password_tokens_user_id_foreign";`);

    this.addSql(`alter table "refresh_tokens" drop constraint "refresh_tokens_user_id_foreign";`);

    this.addSql(`alter table "posts" drop constraint "posts_author_id_foreign";`);

    this.addSql(`alter table "comments" drop constraint "comments_author_id_foreign";`);
    this.addSql(`alter table "comments" drop constraint "comments_post_id_foreign";`);

    this.addSql(`alter table "users" alter column "created_at" drop default;`);
    this.addSql(`alter table "users" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "users" alter column "updated_at" drop default;`);
    this.addSql(`alter table "users" alter column "updated_at" type timestamptz using ("updated_at"::timestamptz);`);
    this.addSql(`alter table "users" alter column "password" type varchar(255) using ("password"::varchar(255));`);
    this.addSql(`alter table "users" alter column "password" set not null;`);

    this.addSql(`drop index "reset_password_tokens_user_id_index";`);

    this.addSql(`alter table "reset_password_tokens" alter column "created_at" drop default;`);
    this.addSql(`alter table "reset_password_tokens" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "reset_password_tokens" add constraint "reset_password_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);

    this.addSql(`drop index "refresh_tokens_user_id_index";`);

    this.addSql(`alter table "refresh_tokens" alter column "created_at" drop default;`);
    this.addSql(`alter table "refresh_tokens" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "refresh_tokens" add constraint "refresh_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "posts" alter column "created_at" drop default;`);
    this.addSql(`alter table "posts" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "posts" alter column "updated_at" drop default;`);
    this.addSql(`alter table "posts" alter column "updated_at" type timestamptz using ("updated_at"::timestamptz);`);
    this.addSql(`alter table "posts" alter column "status" type varchar(255) using ("status"::varchar(255));`);
    this.addSql(`alter table "posts" alter column "status" set not null;`);
    this.addSql(`alter table "posts" add constraint "posts_author_id_foreign" foreign key ("author_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "comments" alter column "created_at" drop default;`);
    this.addSql(`alter table "comments" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "comments" rename column "content" to "body";`);
    this.addSql(`alter table "comments" add constraint "comments_author_id_foreign" foreign key ("author_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "comments" add constraint "comments_post_id_foreign" foreign key ("post_id") references "posts" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "files" cascade;`);

    this.addSql(`alter table "comments" drop constraint "comments_author_id_foreign";`);
    this.addSql(`alter table "comments" drop constraint "comments_post_id_foreign";`);

    this.addSql(`alter table "posts" drop constraint "posts_author_id_foreign";`);

    this.addSql(`alter table "refresh_tokens" drop constraint "refresh_tokens_user_id_foreign";`);

    this.addSql(`alter table "reset_password_tokens" drop constraint "reset_password_tokens_user_id_foreign";`);

    this.addSql(`alter table "comments" alter column "created_at" type timestamptz(6) using ("created_at"::timestamptz(6));`);
    this.addSql(`alter table "comments" alter column "created_at" set default now();`);
    this.addSql(`alter table "comments" rename column "body" to "content";`);
    this.addSql(`alter table "comments" add constraint "comments_author_id_foreign" foreign key ("author_id") references "users" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "comments" add constraint "comments_post_id_foreign" foreign key ("post_id") references "posts" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "posts" alter column "status" type varchar(50) using ("status"::varchar(50));`);
    this.addSql(`alter table "posts" alter column "status" drop not null;`);
    this.addSql(`alter table "posts" alter column "created_at" type timestamptz(6) using ("created_at"::timestamptz(6));`);
    this.addSql(`alter table "posts" alter column "created_at" set default now();`);
    this.addSql(`alter table "posts" alter column "updated_at" type timestamptz(6) using ("updated_at"::timestamptz(6));`);
    this.addSql(`alter table "posts" alter column "updated_at" set default now();`);
    this.addSql(`alter table "posts" add constraint "posts_author_id_foreign" foreign key ("author_id") references "users" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "refresh_tokens" alter column "created_at" type timestamptz(6) using ("created_at"::timestamptz(6));`);
    this.addSql(`alter table "refresh_tokens" alter column "created_at" set default now();`);
    this.addSql(`alter table "refresh_tokens" add constraint "refresh_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
    this.addSql(`create index "refresh_tokens_user_id_index" on "refresh_tokens" ("user_id");`);

    this.addSql(`alter table "reset_password_tokens" alter column "created_at" type timestamptz(6) using ("created_at"::timestamptz(6));`);
    this.addSql(`alter table "reset_password_tokens" alter column "created_at" set default now();`);
    this.addSql(`alter table "reset_password_tokens" add constraint "reset_password_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
    this.addSql(`create index "reset_password_tokens_user_id_index" on "reset_password_tokens" ("user_id");`);

    this.addSql(`alter table "users" alter column "password" type varchar(255) using ("password"::varchar(255));`);
    this.addSql(`alter table "users" alter column "password" drop not null;`);
    this.addSql(`alter table "users" alter column "created_at" type timestamptz(6) using ("created_at"::timestamptz(6));`);
    this.addSql(`alter table "users" alter column "created_at" set default now();`);
    this.addSql(`alter table "users" alter column "updated_at" type timestamptz(6) using ("updated_at"::timestamptz(6));`);
    this.addSql(`alter table "users" alter column "updated_at" set default now();`);
  }

}
