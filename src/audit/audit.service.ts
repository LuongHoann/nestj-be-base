import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager, FilterQuery } from '@mikro-orm/core';
import { AuditLog } from '../database/entities/audit-log.entity';

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
   * @param userEmail - Email của người dùng hoặc 'anonymous'
   * @param action - Hành động: 'create', 'update', 'delete', 'login', 'logout', etc.
   * @param collection - Collection/entity bị ảnh hưởng
   * @param targetId - ID của record bị ảnh hưởng
   * @param details - Chi tiết bổ sung (không chứa sensitive data)
   */
  async logAction(
    userEmail: string | null,
    action: string,
    collection: string,
    targetId: string,
    details?: Record<string, any>,
  ): Promise<void> {
    try {
      const logEntry = this.em.create(AuditLog, {
        userEmail: userEmail || 'Không xác định',
        action,
        collection,
        targetId: String(targetId),
        details,
        timestamp: new Date(),
      });

      await this.em.persistAndFlush(logEntry);

      this.logger.debug(
        `📝 Audit: [${action}] ${collection}/${targetId} by user ${userEmail || 'Không xác định'}`,
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
    userEmail: string | null,
    action:
      | 'login'
      | 'logout'
      | 'login_failed'
      | 'token_refresh'
      | 'password_reset',
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logAction(
      userEmail,
      action,
      'auth',
      userEmail || 'anonymous',
      details,
    );
  }

  /**
   * Query User Logs với filters
   * Useful cho admin dashboard hoặc compliance reports
   */
  async findLogs(options: {
    userEmail?: string;
    collection?: string;
    action?: string;
    search?: string;
    fromDate?: Date | string;
    toDate?: Date | string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const where: FilterQuery<AuditLog> = {};

    if (options.userEmail) {
      where.userEmail = options.userEmail;
    }
    if (options.collection) {
      where.collection = options.collection;
    }
    if (options.action) {
      where.action = options.action;
    }

    if (options.search?.trim()) {
      const search = options.search.trim();
      where.$or = [
        { userEmail: { $ilike: `%${search}%` } },
        { action: { $ilike: `%${search}%` } },
        { collection: { $ilike: `%${search}%` } },
        { targetId: { $ilike: `%${search}%` } },
      ];
    }

    if (options.fromDate || options.toDate) {
      where.timestamp = {};
      if (options.fromDate) {
        where.timestamp.$gte = new Date(options.fromDate);
      }
      if (options.toDate) {
        where.timestamp.$lte = new Date(options.toDate);
      }
    }

    const [data, total] = await this.auditLogRepository.findAndCount(where, {
      orderBy: { timestamp: 'DESC' },
      limit: options.limit || 25,
      offset: options.offset || 0,
    });

    return { data, total };
  }

  /**
   * Xóa logs theo mốc thời gian (1, 3, 6, 12 tháng gần nhất)
   * @param months - Số tháng gần nhất muốn GIỮ LẠI. Xóa các logs trước mốc này.
   */
  async cleanupLogs(months: number): Promise<{ deletedCount: number }> {
    const dateLimit = new Date();
    dateLimit.setMonth(dateLimit.getMonth() - months);

    const deletedCount = await this.em.nativeDelete(AuditLog, {
      timestamp: { $lt: dateLimit },
    });

    this.logger.log(`🧹 Cleaned up ${deletedCount} audit logs older than ${months} months.`);
    return { deletedCount };
  }

  /**
   * Lấy logs của một email cụ thể
   */
  async getLogsByUser(userEmail: string, limit = 20): Promise<AuditLog[]> {
    return this.auditLogRepository.find(
      { userEmail },
      {
        orderBy: { timestamp: 'DESC' },
        limit,
      },
    );
  }

  /**
   * Lấy logs của một record cụ thể (history của 1 item)
   */
  async getLogsByTarget(
    collection: string,
    targetId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find(
      { collection, targetId },
      {
        orderBy: { timestamp: 'DESC' },
      },
    );
  }
}
