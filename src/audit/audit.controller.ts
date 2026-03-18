import {
  Controller,
  Get,
  Query,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AuditLogService } from './audit.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import { ExchangeAuthGuard } from 'src/auth/guards/exchange-auth.guard';

@ApiTags('Audit Logs')
@Controller('audit-logs')
@UseGuards(ExchangeAuthGuard)
@ApiBearerAuth('jwt')
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách audit logs' })
  @ApiQuery({ name: 'search', required: false, description: 'Tìm theo text' })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Từ ngày' })
  @ApiQuery({ name: 'toDate', required: false, description: 'Đến ngày' })
  @ApiQuery({ name: 'page', required: false, description: 'Trang' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Số lượng / trang' })
  async getLogs(
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 25,
  ) {
    const limit = pageSize;
    const offset = (page - 1) * limit;

    const result = await this.auditLogService.findLogs({
      search,
      fromDate,
      toDate,
      limit,
      offset,
    });

    return {
      success: true,
      items: result.data,
      total: result.total,
      page,
      pageSize: limit,
    };
  }

  @Delete('cleanup')
  @AuditAction('Dọn dẹp nhật ký hệ thống')
  @ApiOperation({ summary: 'Dọn dẹp logs cũ' })
  @ApiQuery({ name: 'months', required: true, description: 'Số tháng muốn giữ lại (1, 3, 6, 12)' })
  async cleanup(@Query('months', ParseIntPipe) months: number) {
    const result = await this.auditLogService.cleanupLogs(months);
    return {
      success: true,
      message: `Đã xóa ${result.deletedCount} bản ghi logs cũ hơn ${months} tháng`,
      deletedCount: result.deletedCount,
    };
  }
}
