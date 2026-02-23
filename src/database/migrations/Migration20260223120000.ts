import { Migration } from '@mikro-orm/migrations';

export class Migration20260223120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "roles" ("id" serial primary key, "name" varchar(255) not null, "description" varchar(255) null);`,
    );
    this.addSql(
      `alter table "roles" add constraint "roles_name_unique" unique ("name");`,
    );

    this.addSql(
      `create table "permissions" ("id" serial primary key, "collection" varchar(255) not null, "action" varchar(255) not null, "description" varchar(255) null);`,
    );
    this.addSql(
      `create index "permissions_collection_action_index" on "permissions" ("collection", "action");`,
    );

    this.addSql(
      `create table "roles_permissions" ("role_id" int4 not null, "permission_id" int4 not null, constraint "roles_permissions_pkey" primary key ("role_id", "permission_id"));`,
    );
    this.addSql(
      `alter table "roles_permissions" add constraint "roles_permissions_role_id_foreign" foreign key ("role_id") references "roles" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "roles_permissions" add constraint "roles_permissions_permission_id_foreign" foreign key ("permission_id") references "permissions" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `create table "user_roles" ("user_id" varchar(255) not null, "role_id" int4 not null, constraint "user_roles_pkey" primary key ("user_id", "role_id"));`,
    );
    this.addSql(
      `alter table "user_roles" add constraint "user_roles_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "user_roles" add constraint "user_roles_role_id_foreign" foreign key ("role_id") references "roles" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(`alter table "users" add column "name" varchar(255) null;`);
    this.addSql(`alter table "users" add column "password" varchar(255) null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "user_roles" drop constraint "user_roles_role_id_foreign";`);
    this.addSql(`alter table "user_roles" drop constraint "user_roles_user_id_foreign";`);
    this.addSql(`alter table "roles_permissions" drop constraint "roles_permissions_permission_id_foreign";`);
    this.addSql(`alter table "roles_permissions" drop constraint "roles_permissions_role_id_foreign";`);

    this.addSql(`drop table if exists "user_roles" cascade;`);
    this.addSql(`drop table if exists "roles_permissions" cascade;`);
    this.addSql(`drop table if exists "permissions" cascade;`);
    this.addSql(`drop table if exists "roles" cascade;`);

    this.addSql(`alter table "users" drop column "name";`);
    this.addSql(`alter table "users" drop column "password";`);
  }
}
