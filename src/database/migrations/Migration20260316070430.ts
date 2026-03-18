import { Migration } from '@mikro-orm/migrations';

export class Migration20260316070430 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "global_blocklist" ("id" varchar(255) not null, "sender_email" varchar(255) not null, "blocked_by" varchar(255) not null, "reason" varchar(255) null, "created_at" timestamptz not null, constraint "global_blocklist_pkey" primary key ("id"));`);
    this.addSql(`alter table "global_blocklist" add constraint "global_blocklist_sender_email_unique" unique ("sender_email");`);

    this.addSql(`create table "shared_mailboxes" ("id" varchar(255) not null, "name" varchar(255) not null, "email" varchar(255) not null, "display_name" varchar(255) not null, "exchange_guid" varchar(255) null, "is_active" boolean not null default true, "created_by" varchar(255) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "shared_mailboxes_pkey" primary key ("id"));`);
    this.addSql(`alter table "shared_mailboxes" add constraint "shared_mailboxes_email_unique" unique ("email");`);

    this.addSql(`create table "shared_mailbox_members" ("id" varchar(255) not null, "mailbox_id" varchar(255) not null, "user_id" varchar(255) not null, "role" varchar(255) not null default 'MEMBER', "added_by" varchar(255) null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "shared_mailbox_members_pkey" primary key ("id"));`);
    this.addSql(`alter table "shared_mailbox_members" add constraint "shared_mailbox_members_mailbox_id_user_id_unique" unique ("mailbox_id", "user_id");`);

    this.addSql(`create table "spam_reports" ("id" varchar(255) not null, "reporter_email" varchar(255) not null, "sender_email" varchar(255) not null, "message_id" varchar(255) not null, "created_at" timestamptz not null, constraint "spam_reports_pkey" primary key ("id"));`);

    this.addSql(`alter table "shared_mailbox_members" add constraint "shared_mailbox_members_mailbox_id_foreign" foreign key ("mailbox_id") references "shared_mailboxes" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "shared_mailbox_members" drop constraint "shared_mailbox_members_mailbox_id_foreign";`);

    this.addSql(`drop table if exists "global_blocklist" cascade;`);

    this.addSql(`drop table if exists "shared_mailboxes" cascade;`);

    this.addSql(`drop table if exists "shared_mailbox_members" cascade;`);

    this.addSql(`drop table if exists "spam_reports" cascade;`);
  }

}
