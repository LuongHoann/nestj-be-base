import { Migration } from '@mikro-orm/migrations';

export class Migration20260317011911 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "security_policies" ("id" uuid not null default gen_random_uuid(), "type" text check ("type" in ('WHITELIST', 'BLACKLIST')) not null, "target_type" text check ("target_type" in ('DOMAIN', 'EMAIL')) not null, "value" varchar(255) not null, "created_by" varchar(255) not null, "reason" varchar(255) null, "created_at" timestamptz not null, constraint "security_policies_pkey" primary key ("id"));`);

    this.addSql(`alter table "audit_logs" drop constraint "audit_logs_user_id_foreign";`);

    this.addSql(`alter table "shared_mailbox_members" drop constraint "shared_mailbox_members_mailbox_id_foreign";`);

    this.addSql(`alter table "user_roles" drop constraint "user_roles_user_id_foreign";`);

    this.addSql(`drop index "audit_log_user_id_index";`);
    this.addSql(`alter table "audit_logs" drop column "user_id";`);

    this.addSql(`alter table "audit_logs" add column "user_email" varchar(255) null;`);
    this.addSql(`create index "audit_log_user_email_index" on "audit_logs" ("user_email");`);

    this.addSql(`alter table "shared_mailboxes" alter column "id" drop default;`);
    this.addSql(`alter table "shared_mailboxes" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "shared_mailboxes" alter column "id" set default gen_random_uuid();`);

    this.addSql(`alter table "shared_mailbox_members" alter column "id" drop default;`);
    this.addSql(`alter table "shared_mailbox_members" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "shared_mailbox_members" alter column "id" set default gen_random_uuid();`);
    this.addSql(`alter table "shared_mailbox_members" alter column "mailbox_id" drop default;`);
    this.addSql(`alter table "shared_mailbox_members" alter column "mailbox_id" type uuid using ("mailbox_id"::text::uuid);`);
    this.addSql(`alter table "shared_mailbox_members" alter column "user_id" drop default;`);
    this.addSql(`alter table "shared_mailbox_members" alter column "user_id" type uuid using ("user_id"::text::uuid);`);
    this.addSql(`alter table "shared_mailbox_members" add constraint "shared_mailbox_members_mailbox_id_foreign" foreign key ("mailbox_id") references "shared_mailboxes" ("id") on update cascade;`);

    this.addSql(`alter table "users" alter column "id" drop default;`);
    this.addSql(`alter table "users" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "users" alter column "id" set default gen_random_uuid();`);

    this.addSql(`alter table "user_roles" alter column "user_id" drop default;`);
    this.addSql(`alter table "user_roles" alter column "user_id" type uuid using ("user_id"::text::uuid);`);
    this.addSql(`alter table "user_roles" add constraint "user_roles_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "security_policies" cascade;`);

    this.addSql(`alter table "shared_mailboxes" alter column "id" type text using ("id"::text);`);

    this.addSql(`alter table "shared_mailbox_members" alter column "id" type text using ("id"::text);`);
    this.addSql(`alter table "shared_mailbox_members" alter column "mailbox_id" type text using ("mailbox_id"::text);`);
    this.addSql(`alter table "shared_mailbox_members" alter column "user_id" type text using ("user_id"::text);`);

    this.addSql(`alter table "shared_mailbox_members" drop constraint "shared_mailbox_members_mailbox_id_foreign";`);

    this.addSql(`alter table "users" alter column "id" type text using ("id"::text);`);

    this.addSql(`alter table "user_roles" alter column "user_id" type text using ("user_id"::text);`);

    this.addSql(`alter table "user_roles" drop constraint "user_roles_user_id_foreign";`);

    this.addSql(`alter table "shared_mailboxes" alter column "id" drop default;`);
    this.addSql(`alter table "shared_mailboxes" alter column "id" type varchar(255) using ("id"::varchar(255));`);

    this.addSql(`alter table "shared_mailbox_members" alter column "id" drop default;`);
    this.addSql(`alter table "shared_mailbox_members" alter column "id" type varchar(255) using ("id"::varchar(255));`);
    this.addSql(`alter table "shared_mailbox_members" alter column "mailbox_id" type varchar(255) using ("mailbox_id"::varchar(255));`);
    this.addSql(`alter table "shared_mailbox_members" alter column "user_id" type varchar(255) using ("user_id"::varchar(255));`);
    this.addSql(`alter table "shared_mailbox_members" add constraint "shared_mailbox_members_mailbox_id_foreign" foreign key ("mailbox_id") references "shared_mailboxes" ("id") on update cascade;`);

    this.addSql(`alter table "users" alter column "id" drop default;`);
    this.addSql(`alter table "users" alter column "id" type varchar(255) using ("id"::varchar(255));`);

    this.addSql(`drop index "audit_log_user_email_index";`);
    this.addSql(`alter table "audit_logs" drop column "user_email";`);

    this.addSql(`alter table "audit_logs" add column "user_id" varchar(255) null;`);
    this.addSql(`alter table "audit_logs" add constraint "audit_logs_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete set null;`);
    this.addSql(`create index "audit_log_user_id_index" on "audit_logs" ("user_id");`);

    this.addSql(`alter table "user_roles" alter column "user_id" type varchar(255) using ("user_id"::varchar(255));`);
    this.addSql(`alter table "user_roles" add constraint "user_roles_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
  }

}
