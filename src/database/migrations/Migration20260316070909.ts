import { Migration } from '@mikro-orm/migrations';

export class Migration20260316070909 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "global_blocklist" alter column "id" drop default;`);
    this.addSql(`alter table "global_blocklist" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "global_blocklist" alter column "id" set default gen_random_uuid();`);

    this.addSql(`alter table "spam_reports" alter column "id" drop default;`);
    this.addSql(`alter table "spam_reports" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "spam_reports" alter column "id" set default gen_random_uuid();`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "global_blocklist" alter column "id" type text using ("id"::text);`);

    this.addSql(`alter table "spam_reports" alter column "id" type text using ("id"::text);`);

    this.addSql(`alter table "global_blocklist" alter column "id" drop default;`);
    this.addSql(`alter table "global_blocklist" alter column "id" type varchar(255) using ("id"::varchar(255));`);

    this.addSql(`alter table "spam_reports" alter column "id" drop default;`);
    this.addSql(`alter table "spam_reports" alter column "id" type varchar(255) using ("id"::varchar(255));`);
  }

}
