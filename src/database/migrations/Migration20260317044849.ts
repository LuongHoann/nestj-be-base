import { Migration } from '@mikro-orm/migrations';

export class Migration20260317044849 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "organization_units" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "code" varchar(255) null, "level" text check ("level" in ('BO', 'DON_VI', 'PHONG_BAN')) not null, "parent_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "organization_units_pkey" primary key ("id"));`);

    this.addSql(`alter table "organization_units" add constraint "organization_units_parent_id_foreign" foreign key ("parent_id") references "organization_units" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "shared_mailboxes" add column "org_unit_id" uuid null;`);
    this.addSql(`alter table "shared_mailboxes" add constraint "shared_mailboxes_org_unit_id_foreign" foreign key ("org_unit_id") references "organization_units" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "users" add column "org_unit_id" uuid null, add column "unit_admin_level" text check ("unit_admin_level" in ('BO', 'DON_VI', 'PHONG_BAN')) null;`);
    this.addSql(`alter table "users" add constraint "users_org_unit_id_foreign" foreign key ("org_unit_id") references "organization_units" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "organization_units" drop constraint "organization_units_parent_id_foreign";`);

    this.addSql(`alter table "shared_mailboxes" drop constraint "shared_mailboxes_org_unit_id_foreign";`);

    this.addSql(`alter table "users" drop constraint "users_org_unit_id_foreign";`);

    this.addSql(`drop table if exists "organization_units" cascade;`);

    this.addSql(`alter table "shared_mailboxes" drop column "org_unit_id";`);

    this.addSql(`alter table "users" drop column "org_unit_id", drop column "unit_admin_level";`);
  }

}
