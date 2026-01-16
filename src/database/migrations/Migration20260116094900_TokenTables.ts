import { Migration } from '@mikro-orm/migrations';

/**
 * Migration for Refresh Token and Reset Password Token tables.
 * 
 * Implements split-token model:
 * - token_id: ULID stored in plaintext, indexed for O(1) lookup
 * - secret_hash: argon2 hash of token secret
 * 
 * Security guarantee: All token verification uses indexed lookup by token_id.
 * No table scans, no hash queries.
 */
export class Migration20260116094900_TokenTables extends Migration {

  async up(): Promise<void> {
    // Create refresh_tokens table
    this.addSql(`
      create table "refresh_tokens" (
        "id" serial primary key,
        "token_id" varchar(26) not null,
        "secret_hash" varchar(255) not null,
        "user_id" int not null,
        "expires_at" timestamptz not null,
        "revoked_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        constraint "refresh_tokens_token_id_unique" unique ("token_id")
      );
    `);

    // Create index on token_id for O(1) lookup
    this.addSql(`
      create index "refresh_tokens_token_id_index" 
      on "refresh_tokens" ("token_id");
    `);

    // Create index on user_id for user-specific queries
    this.addSql(`
      create index "refresh_tokens_user_id_index" 
      on "refresh_tokens" ("user_id");
    `);

    // Add foreign key constraint
    this.addSql(`
      alter table "refresh_tokens" 
      add constraint "refresh_tokens_user_id_foreign" 
      foreign key ("user_id") references "users" ("id") 
      on update cascade on delete cascade;
    `);

    // Create reset_password_tokens table
    this.addSql(`
      create table "reset_password_tokens" (
        "id" serial primary key,
        "token_id" varchar(26) not null,
        "secret_hash" varchar(255) not null,
        "user_id" int not null,
        "expires_at" timestamptz not null,
        "used_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        constraint "reset_password_tokens_token_id_unique" unique ("token_id")
      );
    `);

    // Create index on token_id for O(1) lookup
    this.addSql(`
      create index "reset_password_tokens_token_id_index" 
      on "reset_password_tokens" ("token_id");
    `);

    // Create index on user_id
    this.addSql(`
      create index "reset_password_tokens_user_id_index" 
      on "reset_password_tokens" ("user_id");
    `);

    // Add foreign key constraint
    this.addSql(`
      alter table "reset_password_tokens" 
      add constraint "reset_password_tokens_user_id_foreign" 
      foreign key ("user_id") references "users" ("id") 
      on update cascade on delete cascade;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "reset_password_tokens" cascade;`);
    this.addSql(`drop table if exists "refresh_tokens" cascade;`);
  }
}
