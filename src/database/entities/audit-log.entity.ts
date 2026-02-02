import { Entity, PrimaryKey, Property, ManyToOne, Index } from '@mikro-orm/core';
import { User } from './user.entity';

@Entity({ tableName: 'audit_logs' })
@Index({ properties: ['collection', 'targetId'] })
export class AuditLog {
  @PrimaryKey({ type: 'bigint' })
  id!: string;

  @ManyToOne(() => User, { nullable: true, index: 'audit_log_user_id_index' })
  user?: User;

  @Property({ length: 100, index: 'audit_log_collection_index' })
  collection!: string;

  @Property({ length: 50 })
  action!: string;

  @Property({ length: 255, index: 'audit_log_target_id_index' })
  targetId!: string;

  @Property({ type: 'json', nullable: true })
  details?: Record<string, any>;

  @Property({ onCreate: () => new Date() })
  timestamp = new Date();
}
