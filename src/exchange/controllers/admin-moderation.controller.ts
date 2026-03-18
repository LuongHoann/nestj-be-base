import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Delete,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { SpamModerationService } from '../services/spam-moderation.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SecurityPolicyType, SecurityTargetType } from '../../database/entities/security-policy.entity';
import { ExchangeAuthGuard } from 'src/auth/guards/exchange-auth.guard';

@ApiTags('Admin Moderation')
@ApiBearerAuth()
@UseGuards(ExchangeAuthGuard) // Giả định admin cũng dùng JWT chung hoặc có cơ chế phân quyền Role sau này
@Controller('admin/moderation')
export class AdminModerationController {
  constructor(private readonly moderationService: SpamModerationService) {}

  @Post('global-block')
  @ApiOperation({ summary: 'Chặn một địa chỉ email trên toàn hệ thống (Legacy)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['email'],
    },
  })
  async blockGlobal(@Body() dto: { email: string; reason?: string }, @Req() req: any) {
    const adminEmail = req.user.email;
    return this.moderationService.blockGlobal(dto.email, adminEmail, dto.reason);
  }

  @Delete('global-block/:email')
  @ApiOperation({ summary: 'Bỏ chặn một địa chỉ email (Legacy)' })
  async unblockGlobal(@Param('email') email: string) {
    return this.moderationService.unblockGlobal(email);
  }

  @Post('rebuild-blacklist')
  @ApiOperation({ summary: 'Rebuild lại danh sách chặn trong Redis từ Database' })
  async rebuildBlacklist() {
    await this.moderationService.ensureRedisCache();
    return { success: true, message: 'Rebuild triggered' };
  }

  // ================= SECURITY POLICIES (WHITELIST/BLACKLIST) =================

  @Get('security-policies')
  @ApiOperation({ summary: 'Lấy danh sách các chính sách bảo mật' })
  @ApiQuery({ name: 'type', enum: SecurityPolicyType })
  @ApiQuery({ name: 'targetType', enum: SecurityTargetType })
  async getPolicies(
    @Query('type') type: SecurityPolicyType,
    @Query('targetType') targetType: SecurityTargetType,
  ) {
    const policies = await this.moderationService.getPolicies(type, targetType);
    return { success: true, data: policies };
  }

  @Post('security-policies')
  @ApiOperation({ summary: 'Thêm mới một chính sách bảo mật' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['WHITELIST', 'BLACKLIST'] },
        targetType: { type: 'string', enum: ['DOMAIN', 'EMAIL'] },
        value: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['type', 'targetType', 'value'],
    },
  })
  async addPolicy(
    @Body() dto: { type: SecurityPolicyType; targetType: SecurityTargetType; value: string; reason?: string },
    @Req() req: any,
  ) {
    const adminEmail = req.user?.upn || 'admin@system.local';
    return this.moderationService.addPolicy(
      dto.type,
      dto.targetType,
      dto.value,
      adminEmail,
      dto.reason,
    );
  }

  @Delete('security-policies/:id')
  @ApiOperation({ summary: 'Xóa một chính sách bảo mật' })
  async removePolicy(@Param('id') id: string) {
    return this.moderationService.removePolicy(id);
  }
}
