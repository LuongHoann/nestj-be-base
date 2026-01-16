import { Migration } from '@mikro-orm/migrations';

/**
 * RBAC (Role-Based Access Control) migration.
 * 
 * Creates the following tables:
 * 1. roles - Role definitions
 * 2. permissions - Permission definitions with (collection, action) model
 * 3. users_roles - Many-to-many join table for user-role assignments
 * 4. roles_permissions - Many-to-many join table for role-permission grants
 * 
 * Note: This assumes base tables (users, posts, comments) already exist.
 * If they don't, run the base migration first.
 */
export class Migration20260116012800 extends Migration {

  async up(): Promise<void> {
    // Create roles table
    this.addSql(`
      create table "roles" (
        "id" serial primary key,
        "name" varchar(255) not null,
        "description" varchar(255) null,
        constraint "roles_name_unique" unique ("name")
      );
    `);

    // Create permissions table with composite index on (collection, action)
    this.addSql(`
      create table "permissions" (
        "id" serial primary key,
        "collection" varchar(255) not null,
        "action" varchar(255) not null,
        "description" varchar(255) null
      );
    `);

    // Create composite index for efficient permission lookups
    this.addSql(`
      create index "permissions_collection_action_index" 
      on "permissions" ("collection", "action");
    `);

    // Add password field to existing users table (if it exists)
    this.addSql(`
      alter table "users" 
      add column if not exists "password" varchar(255);
    `);

    // Create users_roles join table (many-to-many)
    this.addSql(`
      create table "users_roles" (
        "user_id" int not null,
        "role_id" int not null,
        constraint "users_roles_pkey" primary key ("user_id", "role_id")
      );
    `);

    // Add foreign key constraints for users_roles
    this.addSql(`
      alter table "users_roles" 
      add constraint "users_roles_user_id_foreign" 
      foreign key ("user_id") references "users" ("id") 
      on update cascade on delete cascade;
    `);

    this.addSql(`
      alter table "users_roles" 
      add constraint "users_roles_role_id_foreign" 
      foreign key ("role_id") references "roles" ("id") 
      on update cascade on delete cascade;
    `);

    // Create roles_permissions join table (many-to-many)
    this.addSql(`
      create table "roles_permissions" (
        "role_id" int not null,
        "permission_id" int not null,
        constraint "roles_permissions_pkey" primary key ("role_id", "permission_id")
      );
    `);

    // Add foreign key constraints for roles_permissions
    this.addSql(`
      alter table "roles_permissions" 
      add constraint "roles_permissions_role_id_foreign" 
      foreign key ("role_id") references "roles" ("id") 
      on update cascade on delete cascade;
    `);

    this.addSql(`
      alter table "roles_permissions" 
      add constraint "roles_permissions_permission_id_foreign" 
      foreign key ("permission_id") references "permissions" ("id") 
      on update cascade on delete cascade;
    `);
  }

  async down(): Promise<void> {
    // Drop join tables first (due to foreign key constraints)
    this.addSql(`drop table if exists "roles_permissions" cascade;`);
    this.addSql(`drop table if exists "users_roles" cascade;`);

    // Remove password column from users (if it exists)
    this.addSql(`alter table "users" drop column if exists "password";`);

    // Drop RBAC tables
    this.addSql(`drop table if exists "permissions" cascade;`);
    this.addSql(`drop table if exists "roles" cascade;`);
  }
}
