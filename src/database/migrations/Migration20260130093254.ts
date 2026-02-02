import { Migration } from '@mikro-orm/migrations';

export class Migration20260130093254 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "audit_logs" ("id" bigserial primary key, "user_id" int null, "collection" varchar(100) not null, "action" varchar(50) not null, "target_id" varchar(255) not null, "details" jsonb null, "timestamp" timestamptz not null);`);
    this.addSql(`create index "audit_log_user_id_index" on "audit_logs" ("user_id");`);
    this.addSql(`create index "audit_log_collection_index" on "audit_logs" ("collection");`);
    this.addSql(`create index "audit_log_target_id_index" on "audit_logs" ("target_id");`);
    this.addSql(`create index "audit_logs_collection_target_id_index" on "audit_logs" ("collection", "target_id");`);

    this.addSql(`alter table "audit_logs" add constraint "audit_logs_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "files" alter column "id" drop default;`);
    this.addSql(`alter table "files" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "files" alter column "id" set default gen_random_uuid();`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "audit_logs" cascade;`);

    this.addSql(`alter table "files" alter column "id" drop default;`);
    this.addSql(`alter table "files" alter column "id" drop default;`);
    this.addSql(`alter table "files" alter column "id" type uuid using ("id"::text::uuid);`);
  }

}
