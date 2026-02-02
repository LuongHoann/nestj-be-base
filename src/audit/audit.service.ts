import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager, FilterQuery } from '@mikro-orm/core';
import { AuditLog } from '../database/entities/audit-log.entity';
import { User } from '../database/entities/user.entity';

/**
 * AuditLogService - Quản lý User Logs (Business Audit Trail)
 * 
 * User Logs được lưu vào database để:
 * - Tracking ai đã làm gì, lúc nào
 * - Compliance và security audit
 * - Rollback/debugging khi cần
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger('AuditLogService');

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: EntityRepository<AuditLog>,
    private readonly em: EntityManager,
  ) {}

  /**
   * Ghi một User Log entry vào database
   * 
   * @param user - User object hoặc { id } object, null nếu anonymous
   * @param action - Hành động: 'create', 'update', 'delete', 'login', 'logout', etc.
   * @param collection - Collection/entity bị ảnh hưởng
   * @param targetId - ID của record bị ảnh hưởng
   * @param details - Chi tiết bổ sung (không chứa sensitive data)
   */
  async logAction(
    user: User | { id: string | number } | null,
    action: string,
    collection: string,
    targetId: string,
    details?: Record<string, any>,
  ): Promise<void> {
    try {
      const logEntry = this.em.create(AuditLog, {
        user: user ? { id: Number((user as any).id) } as User : undefined,
        action,
        collection,
        targetId: String(targetId),
        details,
        timestamp: new Date(),
      });

      await this.em.persistAndFlush(logEntry);
      
      this.logger.debug(
        `📝 Audit: [${action}] ${collection}/${targetId} by user ${(user as any)?.id || 'anonymous'}`,
      );
    } catch (error) {
      // Log error but don't throw - audit should not break main flow
      this.logger.error(`Failed to save audit log: ${error.message}`);
    }
  }

  /**
   * Ghi log cho authentication events
   */
  async logAuth(
    userId: string | number | null,
    action: 'login' | 'logout' | 'login_failed' | 'token_refresh' | 'password_reset',
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logAction(
      userId ? { id: userId } : null,
      action,
      'auth',
      String(userId || 'anonymous'),
      details,
    );
  }

  /**
   * Query User Logs với filters
   * Useful cho admin dashboard hoặc compliance reports
   */
  async findLogs(options: {
    userId?: number;
    collection?: string;
    action?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const where: FilterQuery<AuditLog> = {};

    if (options.userId) {
      where.user = { id: options.userId };
    }
    if (options.collection) {
      where.collection = options.collection;
    }
    if (options.action) {
      where.action = options.action;
    }
    if (options.fromDate || options.toDate) {
      where.timestamp = {};
      if (options.fromDate) {
        where.timestamp.$gte = options.fromDate;
      }
      if (options.toDate) {
        where.timestamp.$lte = options.toDate;
      }
    }

    const [data, total] = await this.auditLogRepository.findAndCount(where, {
      orderBy: { timestamp: 'DESC' },
      limit: options.limit || 50,
      offset: options.offset || 0,
      populate: ['user'],
    });

    return { data, total };
  }

  /**
   * Lấy logs của một user cụ thể
   */
  async getLogsByUser(userId: number, limit = 20): Promise<AuditLog[]> {
    return this.auditLogRepository.find(
      { user: { id: userId } },
      {
        orderBy: { timestamp: 'DESC' },
        limit,
      },
    );
  }

  /**
   * Lấy logs của một record cụ thể (history của 1 item)
   */
  async getLogsByTarget(collection: string, targetId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find(
      { collection, targetId },
      {
        orderBy: { timestamp: 'DESC' },
        populate: ['user'],
      },
    );
  }
}
