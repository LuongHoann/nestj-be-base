import { Entity, PrimaryKey, Property, ManyToOne, Unique } from '@mikro-orm/core';
import { ulid } from 'ulid';
import { SharedMailbox } from './shared-mailbox.entity';

export enum SharedMailboxRole {
  OWNER = 'OWNER', // FullAccess + SendAs
  MEMBER = 'MEMBER', // FullAccess
}

@Entity({ tableName: 'shared_mailbox_members' })
@Unique({ properties: ['mailbox', 'userId'] }) // Ngăn chặn duplicate membership
export class SharedMailboxMember {
  @PrimaryKey()
  id: string = ulid();

  @ManyToOne(() => SharedMailbox)
  mailbox!: SharedMailbox;

  @Property()
  userId!: string; // Reference to User ID

  @Property({ type: 'string' })
  role: SharedMailboxRole = SharedMailboxRole.MEMBER;

  @Property({ nullable: true })
  addedBy?: string; // Reference to Admin User ID

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
