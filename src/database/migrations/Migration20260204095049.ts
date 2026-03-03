import { Migration } from '@mikro-orm/migrations';

export class Migration20260204095049 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "roles_permissions" drop constraint "roles_permissions_permission_id_foreign";`,
    );

    this.addSql(
      `alter table "roles_permissions" drop constraint "roles_permissions_role_id_foreign";`,
    );

    this.addSql(
      `create table "users" ("id" varchar(255) not null, "email" varchar(255) not null, "is_active" boolean not null default true, "mailbox_initialized" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "users_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "users" add constraint "users_email_unique" unique ("email");`,
    );

    this.addSql(
      `create table "audit_logs" ("id" bigserial primary key, "user_id" varchar(255) null, "collection" varchar(100) not null, "action" varchar(50) not null, "target_id" varchar(255) not null, "details" jsonb null, "timestamp" timestamptz not null);`,
    );
    this.addSql(
      `create index "audit_log_user_id_index" on "audit_logs" ("user_id");`,
    );
    this.addSql(
      `create index "audit_log_collection_index" on "audit_logs" ("collection");`,
    );
    this.addSql(
      `create index "audit_log_target_id_index" on "audit_logs" ("target_id");`,
    );
    this.addSql(
      `create index "audit_logs_collection_target_id_index" on "audit_logs" ("collection", "target_id");`,
    );

    this.addSql(
      `alter table "audit_logs" add constraint "audit_logs_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete set null;`,
    );

    this.addSql(`drop table if exists "permissions" cascade;`);

    this.addSql(`drop table if exists "roles" cascade;`);

    this.addSql(`drop table if exists "roles_permissions" cascade;`);

    this.addSql(`alter table "files" alter column "id" drop default;`);
    this.addSql(
      `alter table "files" alter column "id" type uuid using ("id"::text::uuid);`,
    );
    this.addSql(
      `alter table "files" alter column "id" set default gen_random_uuid();`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "audit_logs" drop constraint "audit_logs_user_id_foreign";`,
    );

    this.addSql(
      `create table "permissions" ("id" serial primary key, "collection" varchar(255) not null, "action" varchar(255) not null, "description" varchar(255) null);`,
    );
    this.addSql(
      `create index "permissions_collection_action_index" on "permissions" ("collection", "action");`,
    );

    this.addSql(
      `create table "roles" ("id" serial primary key, "name" varchar(255) not null, "description" varchar(255) null);`,
    );
    this.addSql(
      `alter table "roles" add constraint "roles_name_unique" unique ("name");`,
    );

    this.addSql(
      `create table "roles_permissions" ("role_id" int4 not null, "permission_id" int4 not null, constraint "roles_permissions_pkey" primary key ("role_id", "permission_id"));`,
    );

    this.addSql(
      `alter table "roles_permissions" add constraint "roles_permissions_permission_id_foreign" foreign key ("permission_id") references "permissions" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "roles_permissions" add constraint "roles_permissions_role_id_foreign" foreign key ("role_id") references "roles" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(`drop table if exists "users" cascade;`);

    this.addSql(`drop table if exists "audit_logs" cascade;`);

    this.addSql(`alter table "files" alter column "id" drop default;`);
    this.addSql(`alter table "files" alter column "id" drop default;`);
    this.addSql(
      `alter table "files" alter column "id" type uuid using ("id"::text::uuid);`,
    );
  }
}
