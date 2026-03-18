import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SpamReport } from '../../database/entities/spam-report.entity';
import { GlobalBlocklist } from '../../database/entities/global-blocklist.entity';
import {
  SecurityPolicy,
  SecurityPolicyType,
  SecurityTargetType,
} from '../../database/entities/security-policy.entity';
import { DragonflyService } from '../../common/cache/dragonfly.service';
import { ConfigService } from '@nestjs/config';
import { RspamdSyncService } from './rspamd-sync.service';

@Injectable()
export class SpamModerationService implements OnModuleInit {
  private readonly logger = new Logger(SpamModerationService.name);
  
  // Redis keys
  private readonly globalBlacklistKey: string;
  private readonly wlDomainKey: string;
  private readonly wlEmailKey: string;
  private readonly blDomainKey: string;
  private readonly blEmailKey: string;
  private readonly lockKey: string;

  constructor(
    @InjectRepository(SpamReport)
    private readonly spamReportRepo: EntityRepository<SpamReport>,
    @InjectRepository(GlobalBlocklist)
    private readonly blocklistRepo: EntityRepository<GlobalBlocklist>,
    @InjectRepository(SecurityPolicy)
    private readonly policyRepo: EntityRepository<SecurityPolicy>,
    private readonly cache: DragonflyService,
    private readonly config: ConfigService,
    private readonly rspamdSync: RspamdSyncService,
  ) {
    this.globalBlacklistKey = this.config.get<string>('REDIS_BLACKLIST_KEY', 'rspamd:global_blacklist');
    this.wlDomainKey = this.config.get<string>('REDIS_WL_DOMAIN_KEY', 'rspamd:whitelist:domain');
    this.wlEmailKey = this.config.get<string>('REDIS_WL_EMAIL_KEY', 'rspamd:whitelist:email');
    this.blDomainKey = this.config.get<string>('REDIS_BL_DOMAIN_KEY', 'rspamd:blacklist:domain');
    this.blEmailKey = this.config.get<string>('REDIS_BL_EMAIL_KEY', 'rspamd:blacklist:email');
    
    this.lockKey = 'security:rebuild:lock';
  }

  async onModuleInit() {
    await this.ensureRedisCache();
  }

  // ============== SPAM REPORT ==============
  async reportSpam(reporterEmail: string, senderEmail: string, messageId: string) {
    try {
      const report = new SpamReport(reporterEmail, senderEmail, messageId);
      await this.spamReportRepo.getEntityManager().persistAndFlush(report);
      this.logger.log(`Spam reported by ${reporterEmail} for sender ${senderEmail}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to report spam: ${error.message}`);
      throw error;
    }
  }

  // ============== GLOBAL BLOCKLIST (Legacy) ==============
  async blockGlobal(senderEmail: string, adminEmail: string, reason?: string) {
    try {
      let block = await this.blocklistRepo.findOne({ senderEmail });
      if (!block) {
        block = new GlobalBlocklist(senderEmail, adminEmail, reason);
        await this.blocklistRepo.getEntityManager().persistAndFlush(block);
      }
      await this.cache.sadd(this.globalBlacklistKey, senderEmail);
      this.logger.log(`Global block added for ${senderEmail} by ${adminEmail}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to block global: ${error.message}`);
      throw error;
    }
  }

  async unblockGlobal(senderEmail: string) {
    try {
      const block = await this.blocklistRepo.findOne({ senderEmail });
      if (block) {
        await this.blocklistRepo.getEntityManager().removeAndFlush(block);
      }
      await this.cache.srem(this.globalBlacklistKey, senderEmail);
      this.logger.log(`Global block removed for ${senderEmail}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to unblock global: ${error.message}`);
      throw error;
    }
  }

  // ============== SECURITY POLICIES ==============
  
  getRedisKeyForPolicy(type: SecurityPolicyType, targetType: SecurityTargetType): string {
    if (type === SecurityPolicyType.WHITELIST) {
      return targetType === SecurityTargetType.DOMAIN ? this.wlDomainKey : this.wlEmailKey;
    } else {
      return targetType === SecurityTargetType.DOMAIN ? this.blDomainKey : this.blEmailKey;
    }
  }

  getFileNameForPolicy(type: SecurityPolicyType, targetType: SecurityTargetType): string {
    if (type === SecurityPolicyType.WHITELIST) {
      return targetType === SecurityTargetType.DOMAIN ? 'global_whitelist_domains.map' : 'global_whitelist.map';
    } else {
      return targetType === SecurityTargetType.DOMAIN ? 'global_blacklist_domains.map' : 'global_blacklist.map';
    }
  }

  async getPolicies(type: SecurityPolicyType, targetType: SecurityTargetType) {
    return this.policyRepo.find(
      { type, targetType },
      { orderBy: { createdAt: 'DESC' } }
    );
  }

  async addPolicy(
    type: SecurityPolicyType,
    targetType: SecurityTargetType,
    value: string,
    adminEmail: string,
    reason?: string,
  ) {
    const em = this.policyRepo.getEntityManager().fork(); // Create a fork for transaction
    
    try {
      const existing = await em.findOne(SecurityPolicy, { type, targetType, value });
      if (existing) {
        return { success: false, message: 'Chính sách này đã tồn tại trong hệ thống.' };
      }

      const policy = new SecurityPolicy(type, targetType, value, adminEmail, reason);
      await em.persistAndFlush(policy);

      const redisKey = this.getRedisKeyForPolicy(type, targetType);
      await this.cache.sadd(redisKey, value);
      
      // Update Remote File via SSH
      const fileName = this.getFileNameForPolicy(type, targetType);
      try {
        await this.rspamdSync.appendToPolicyFile(fileName, value);
        await this.rspamdSync.reloadRspamd();
        this.logger.log(`SSH Sync: Synced ${value} to ${fileName} and reloaded rspamd`);
      } catch (sshErr) {
        this.logger.error(`SSH Sync failed on addPolicy. Rolling back DB & Redis... Details: ${sshErr.message}`);
        
        // --- ROLLBACK LOGIC ---
        await em.removeAndFlush(policy); // Rollback DB
        await this.cache.srem(redisKey, value); // Rollback Redis
        
        throw new Error(`Đồng bộ luật chặn email sang hệ thống Rspamd thất bại. Chi tiết lỗi: ${sshErr.message}`);
      }

      this.logger.log(`Security policy added: [${type}] ${targetType}=${value}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to add policy: ${error.message}`);
      throw error;
    }
  }

  async removePolicy(id: string) {
    const em = this.policyRepo.getEntityManager().fork();
    
    try {
      const policy = await em.findOne(SecurityPolicy, { id });
      if (policy) {
        await em.removeAndFlush(policy);
        
        const redisKey = this.getRedisKeyForPolicy(policy.type, policy.targetType);
        await this.cache.srem(redisKey, policy.value);

        // Remove from Remote File via SSH
        const fileName = this.getFileNameForPolicy(policy.type, policy.targetType);
        try {
          await this.rspamdSync.removeFromPolicyFile(fileName, policy.value);
          await this.rspamdSync.reloadRspamd();
          this.logger.log(`SSH Sync: Removed ${policy.value} from ${fileName} and reloaded rspamd`);
        } catch (sshErr) {
          this.logger.error(`SSH Sync failed on removePolicy. Rolling back DB & Redis... Details: ${sshErr.message}`);
          
          // --- ROLLBACK LOGIC ---
          // Khôi phục lại dữ liệu vì thao tác xóa file thất bại
          const restoredPolicy = new SecurityPolicy(policy.type, policy.targetType, policy.value, policy.createdBy, policy.reason);
          restoredPolicy.id = policy.id; // Giữ nguyên ID cũ
          restoredPolicy.createdAt = policy.createdAt; // Giữ nguyên thời gian tạo
          await em.persistAndFlush(restoredPolicy);
          await this.cache.sadd(redisKey, policy.value);
          
          throw new Error(`Xoá cấu hình trên Gateway thất bại (${sshErr.message}). Quy tắc đã được khôi phục trên hệ thống.`);
        }

        this.logger.log(`Security policy removed: ${policy.id}`);
      }
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to remove policy: ${error.message}`);
      throw error;
    }
  }

  // ============== SYNC & HEALING ==============
  
  async ensureRedisCache() {
    const lock = await this.cache.setIfNotExist(this.lockKey, '1', 30);
    if (!lock) {
      return;
    }

    try {
      // Rebuild Global Blocklist
      if (!(await this.cache.exists(this.globalBlacklistKey))) {
        const globalBlocks = await this.blocklistRepo.findAll();
        if (globalBlocks.length > 0) {
          const emails = globalBlocks.map(item => item.senderEmail);
          await this.cache.sadd(this.globalBlacklistKey, ...emails);
        }
      }

      // Rebuild Security Policies
      const policies = await this.policyRepo.findAll();
      
      const keysConfig = [
        { type: SecurityPolicyType.WHITELIST, targetType: SecurityTargetType.DOMAIN, key: this.wlDomainKey },
        { type: SecurityPolicyType.WHITELIST, targetType: SecurityTargetType.EMAIL, key: this.wlEmailKey },
        { type: SecurityPolicyType.BLACKLIST, targetType: SecurityTargetType.DOMAIN, key: this.blDomainKey },
        { type: SecurityPolicyType.BLACKLIST, targetType: SecurityTargetType.EMAIL, key: this.blEmailKey },
      ];

      for (const config of keysConfig) {
        if (!(await this.cache.exists(config.key))) {
          const values = policies
            .filter(p => p.type === config.type && p.targetType === config.targetType)
            .map(p => p.value);
            
          if (values.length > 0) {
            await this.cache.sadd(config.key, ...values);
          }
        }
      }

      this.logger.log('Redis cache verified and rebuilt if necessary.');
    } catch (error) {
      this.logger.error(`Failed to rebuild Redis cache: ${error.message}`);
    } finally {
      await this.cache.del(this.lockKey);
    }
  }

  async forceSyncAllToRemote() {
    try {
      this.logger.log('Starting Force Sync of all Security Policies to Remote Rspamd');
      const policies = await this.policyRepo.findAll();
      
      const fileConfig = [
        { type: SecurityPolicyType.WHITELIST, targetType: SecurityTargetType.DOMAIN, fileName: 'global_whitelist_domains' },
        { type: SecurityPolicyType.WHITELIST, targetType: SecurityTargetType.EMAIL, fileName: 'global_whitelist' },
        { type: SecurityPolicyType.BLACKLIST, targetType: SecurityTargetType.DOMAIN, fileName: 'global_blacklist_domains' },
        { type: SecurityPolicyType.BLACKLIST, targetType: SecurityTargetType.EMAIL, fileName: 'global_blacklist' },
      ];

      for (const config of fileConfig) {
        const values = policies
          .filter(p => p.type === config.type && p.targetType === config.targetType)
          .map(p => p.value);
        
        await this.rspamdSync.syncFullFile(config.fileName, values);
        this.logger.log(`SSH Force Sync: Updated ${config.fileName} with ${values.length} records`);
      }

      await this.rspamdSync.reloadRspamd();
      this.logger.log('Force Sync completed and rspamd reloaded');
      return { success: true };
    } catch (error) {
      this.logger.error(`Force Sync to Remote failed: ${error.message}`);
      throw error;
    }
  }

  @Cron('0 */15 * * * *')
  async handleCron() {
    this.logger.debug('Running 15-minute scheduled moderation tasks');
    await this.ensureRedisCache();
    // Optional: We can also run ForceSync randomly or daily if requested.
  }
}
