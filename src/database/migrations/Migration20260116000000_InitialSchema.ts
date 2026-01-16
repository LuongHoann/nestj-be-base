import { Migration } from '@mikro-orm/migrations';

/**
 * Initial database schema migration.
 * Creates base tables: users, posts, comments
 */
export class Migration20260116000000_InitialSchema extends Migration {

  async up(): Promise<void> {
    // Create users table
    this.addSql(`
      create table if not exists "users" (
        "id" serial primary key,
        "name" varchar(255) not null,
        "email" varchar(255) not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "users_email_unique" unique ("email")
      );
    `);

    // Create posts table
    this.addSql(`
      create table if not exists "posts" (
        "id" serial primary key,
        "title" varchar(255) not null,
        "content" text not null,
        "author_id" int not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "posts_author_id_foreign" 
        foreign key ("author_id") references "users" ("id") 
        on update cascade on delete cascade
      );
    `);

    // Create comments table
    this.addSql(`
      create table if not exists "comments" (
        "id" serial primary key,
        "content" text not null,
        "author_id" int not null,
        "post_id" int not null,
        "created_at" timestamptz not null default now(),
        constraint "comments_author_id_foreign" 
        foreign key ("author_id") references "users" ("id") 
        on update cascade on delete cascade,
        constraint "comments_post_id_foreign" 
        foreign key ("post_id") references "posts" ("id") 
        on update cascade on delete cascade
      );
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "comments" cascade;`);
    this.addSql(`drop table if exists "posts" cascade;`);
    this.addSql(`drop table if exists "users" cascade;`);
  }
}
