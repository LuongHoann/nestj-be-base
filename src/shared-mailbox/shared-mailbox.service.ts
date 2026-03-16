import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EntityManager, QueryOrder } from '@mikro-orm/core';
import { SharedMailbox } from '../database/entities/shared-mailbox.entity';
import { SharedMailboxMember, SharedMailboxRole } from '../database/entities/shared-mailbox-member.entity';
import { User } from '../database/entities/user.entity';
import { AuditLog } from '../database/entities/audit-log.entity';
import { SharedMailboxScriptRunner } from './shared-mailbox.runner';
import {
  CreateSharedMailboxDto,
  UpdateSharedMailboxDto,
  AddSharedMailboxMemberDto,
} from './shared-mailbox.dto';

@Injectable()
export class SharedMailboxService {
  private readonly logger = new Logger(SharedMailboxService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly scriptRunner: SharedMailboxScriptRunner,
  ) {}

  async list(page: number, pageSize: number, search?: string) {
    const limit = Math.max(1, Math.min(pageSize || 20, 100));
    const offset = Math.max(0, (page - 1) * limit);

    const where: any = {};
    if (search?.trim()) {
      where.$or = [
        { email: { $ilike: `%${search}%` } },
        { name: { $ilike: `%${search}%` } },
        { displayName: { $ilike: `%${search}%` } },
      ];
    }

    const [items, total] = await this.em.findAndCount(SharedMailbox, where, {
      limit,
      offset,
      orderBy: { createdAt: QueryOrder.DESC },
    });

    return { items, total, page, pageSize: limit };
  }

  async create(dto: CreateSharedMailboxDto, adminUserId: string) {
    const existing = await this.em.findOne(SharedMailbox, { email: dto.email });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    // Transactional Workflow: Run PS Script first, then save to DB
    const scriptResult = await this.scriptRunner.run('create', {
      name: dto.name,
      email: dto.email,
      displayName: dto.displayName,
    });

    const exchangeGuid = scriptResult.Mailbox?.ExchangeGuid;

    const mailbox = this.em.create(SharedMailbox, {
      name: dto.name,
      email: dto.email,
      displayName: dto.displayName,
      exchangeGuid,
      createdBy: adminUserId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const audit = this.em.create(AuditLog, {
      collection: 'shared_mailbox',
      targetId: mailbox.id,
      action: 'CREATE',
      user: { id: adminUserId } as any,
      details: { email: dto.email, displayName: dto.displayName },
      timestamp: new Date(),
    });

    // Commit to DB after Script is successful
    await this.em.begin();
    try {
      await this.em.persistAndFlush([mailbox, audit]);
      await this.em.commit();
      return mailbox;
    } catch (e) {
      await this.em.rollback();
      this.logger.error(`DB Save Failed after PS Create: ${e.message}`, e.stack);
      throw new BadRequestException('Exchange mailbox created but DB failed to save.');
    }
  }

  async addMember(mailboxId: string, dto: AddSharedMailboxMemberDto, adminUserId: string) {
    const mailbox = await this.em.findOne(SharedMailbox, { id: mailboxId });
    if (!mailbox) throw new NotFoundException('Shared Mailbox not found');

    const targetUser = await this.em.findOne(User, { email: dto.userEmail });
    if (!targetUser) throw new NotFoundException('Target User not found');

    const existingMember = await this.em.findOne(SharedMailboxMember, {
      mailbox,
      userId: targetUser.id,
    });
    if (existingMember) {
      throw new ConflictException('User is already a member of this Shared Mailbox');
    }

    // Call PowerShell
    await this.scriptRunner.run('add-permission', {
      mailboxEmail: mailbox.email,
      userEmail: targetUser.email,
      role: dto.role, // 'OWNER' or 'MEMBER'
    });

    const member = this.em.create(SharedMailboxMember, {
      mailbox,
      userId: targetUser.id,
      role: dto.role,
      addedBy: adminUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const audit = this.em.create(AuditLog, {
      collection: 'shared_mailbox',
      targetId: mailbox.id,
      action: 'ADD_MEMBER',
      user: { id: adminUserId } as any,
      details: { targetUserId: targetUser.id, targetUserEmail: targetUser.email, role: dto.role },
      timestamp: new Date(),
    });

    await this.em.begin();
    try {
      await this.em.persistAndFlush([member, audit]);
      await this.em.commit();
      return member;
    } catch (e) {
      await this.em.rollback();
      throw new BadRequestException('Failed to save to Database');
    }
  }

  async removeMember(mailboxId: string, targetUserId: string, adminUserId: string) {
    const mailbox = await this.em.findOne(SharedMailbox, { id: mailboxId });
    if (!mailbox) throw new NotFoundException('Shared Mailbox not found');

    const targetUser = await this.em.findOne(User, { id: targetUserId });
    if (!targetUser) throw new NotFoundException('Target User not found');

    const member = await this.em.findOne(SharedMailboxMember, {
      mailbox: mailbox.id,
      userId: targetUser.id,
    });

    if (!member) throw new NotFoundException('User is not a member of this Shared Mailbox');

    // Call PowerShell to remove both FullAccess and SendAs
    await this.scriptRunner.run('remove-permission', {
      mailboxEmail: mailbox.email,
      userEmail: targetUser.email,
    });

    const audit = this.em.create(AuditLog, {
       collection: 'shared_mailbox',
       targetId: mailbox.id,
       action: 'REMOVE_MEMBER',
       user: { id: adminUserId } as any,
       details: { targetUserId: targetUser.id, targetUserEmail: targetUser.email, previousRole: member.role },
       timestamp: new Date(),
    });

    await this.em.begin();
    try {
       this.em.remove(member);
       await this.em.persistAndFlush(audit);
       await this.em.commit();
       return { success: true };
    } catch(e) {
       await this.em.rollback();
       throw new BadRequestException('Failed to remove member record from Database');
    }
  }

  async get(id: string) {
    const mailbox = await this.em.findOne(SharedMailbox, { id }, { populate: ['members' as any] });
    if (!mailbox) throw new NotFoundException('Shared Mailbox not found');
    return mailbox;
  }

  async update(id: string, dto: UpdateSharedMailboxDto, adminUserId: string) {
    const mailbox = await this.em.findOne(SharedMailbox, { id });
    if (!mailbox) throw new NotFoundException('Shared Mailbox not found');

    const oldEmail = mailbox.email;
    const nextEmail = dto.email ?? mailbox.email;
    const nextDisplayName = dto.displayName ?? mailbox.displayName;

    if (dto.email && dto.email !== oldEmail) {
      const existing = await this.em.findOne(SharedMailbox, { email: dto.email });
      if (existing) throw new ConflictException('Email already exists');
    }

    await this.scriptRunner.run('update', {
      exchangeGuid: mailbox.exchangeGuid,
      oldEmail,
      email: nextEmail,
      displayName: nextDisplayName,
    });

    mailbox.email = nextEmail;
    mailbox.displayName = nextDisplayName;

    const audit = this.em.create(AuditLog, {
      collection: 'shared_mailbox',
      targetId: mailbox.id,
      action: 'UPDATE',
      user: { id: adminUserId } as any,
      details: { email: nextEmail, displayName: nextDisplayName },
      timestamp: new Date(),
    });

    await this.em.persistAndFlush([mailbox, audit]);
    return mailbox;
  }

  async disable(id: string, adminUserId: string) {
    const mailbox = await this.em.findOne(SharedMailbox, { id });
    if (!mailbox) throw new NotFoundException('Shared Mailbox not found');

    await this.scriptRunner.run('disable', {
      exchangeGuid: mailbox.exchangeGuid,
      email: mailbox.email,
    });

    mailbox.isActive = false;

    const audit = this.em.create(AuditLog, {
      collection: 'shared_mailbox',
      targetId: mailbox.id,
      action: 'DISABLE',
      user: { id: adminUserId } as any,
      timestamp: new Date(),
    });

    await this.em.persistAndFlush([mailbox, audit]);
    return { success: true };
  }

  async getForUser(userId: string): Promise<SharedMailbox[]> {
    const memberships = await this.em.find(SharedMailboxMember, { userId }, { populate: ['mailbox'] as any });
    return memberships.map(m => m.mailbox) as SharedMailbox[];
  }

  async restore(id: string, adminUserId: string) {
    const mailbox = await this.em.findOne(SharedMailbox, { id });
    if (!mailbox) throw new NotFoundException('Shared Mailbox not found');

    await this.scriptRunner.run('restore', {
      exchangeGuid: mailbox.exchangeGuid,
      email: mailbox.email,
    });

    mailbox.isActive = true;

    const audit = this.em.create(AuditLog, {
      collection: 'shared_mailbox',
      targetId: mailbox.id,
      action: 'RESTORE',
      user: { id: adminUserId } as any,
      timestamp: new Date(),
    });

    await this.em.persistAndFlush([mailbox, audit]);
    return { success: true };
  }

  async permanentDelete(id: string, adminUserId: string) {
    const mailbox = await this.em.findOne(SharedMailbox, { id });
    if (!mailbox) throw new NotFoundException('Shared Mailbox not found');

    await this.scriptRunner.run('delete', {
      exchangeGuid: mailbox.exchangeGuid,
      email: mailbox.email,
    });

    const audit = this.em.create(AuditLog, {
      collection: 'shared_mailbox',
      targetId: mailbox.id,
      action: 'PERMANENT_DELETE',
      user: { id: adminUserId } as any,
      timestamp: new Date(),
    });

    await this.em.begin();
    try {
      // Remove all members first due to FK or orphan removal
      await this.em.nativeDelete(SharedMailboxMember, { mailbox: mailbox.id });
      this.em.remove(mailbox);
      await this.em.persistAndFlush(audit);
      await this.em.commit();
      return { success: true };
    } catch (e) {
      await this.em.rollback();
      throw new BadRequestException('Failed to delete from Database');
    }
  }
}
