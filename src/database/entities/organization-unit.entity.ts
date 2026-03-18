import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
  Enum,
} from '@mikro-orm/core';

export enum UnitLevel {
  BO = 'BO',             // Cấp 1: Bộ Giáo Dục và Đào Tạo
  DON_VI = 'DON_VI',     // Cấp 2: Cục, Vụ, Viện
  PHONG_BAN = 'PHONG_BAN' // Cấp 3: Các phòng trực thuộc Cục, Vụ, Viện
}

@Entity({ tableName: 'organization_units' })
export class OrganizationUnit {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property()
  name!: string;

  @Property({ nullable: true })
  code?: string;

  @Enum({ items: () => UnitLevel })
  level!: UnitLevel;

  @ManyToOne(() => OrganizationUnit, { nullable: true })
  parent?: OrganizationUnit;

  @OneToMany(() => OrganizationUnit, (unit) => unit.parent)
  children = new Collection<OrganizationUnit>(this);

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();
}
