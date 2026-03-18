import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SharedMailboxService } from './shared-mailbox.service';
import {
  CreateSharedMailboxDto,
  UpdateSharedMailboxDto,
  AddSharedMailboxMemberDto,
} from './shared-mailbox.dto';
import { SharedMailbox } from '../database/entities/shared-mailbox.entity';
import { ExchangeAuthGuard } from '../auth/guards/exchange-auth.guard';
import { AuditAction } from '../common/decorators/audit-action.decorator';

@ApiTags('Shared Mailbox')
@Controller('shared-mailbox')
@UseGuards(ExchangeAuthGuard)
@ApiBearerAuth()
export class SharedMailboxController {
  constructor(private readonly sharedMailboxService: SharedMailboxService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách Shared Mailbox (Admin)' })
  async list(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
    @Query('search') search?: string,
  ) {
    return this.sharedMailboxService.list(Number(page), Number(pageSize), search);
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy danh sách các Shared Mailbox mà user hiện tại được quyền truy cập' })
  async getMe(@Req() req: any): Promise<SharedMailbox[]> {
    return this.sharedMailboxService.getForUserByEmail(req.user.email);
  }

  @Post()
  @AuditAction('Tạo Shared Mailbox')
  @ApiOperation({ summary: 'Tạo Shared Mailbox mới' })
  async create(@Body() dto: CreateSharedMailboxDto, @Req() req: any) {
    return this.sharedMailboxService.create(dto, req.user.email);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết Shared Mailbox' })
  async get(@Param('id') id: string) {
    return this.sharedMailboxService.get(id);
  }

  @Put(':id')
  @AuditAction('Cập nhật Shared Mailbox')
  @ApiOperation({ summary: 'Cập nhật thông tin Shared Mailbox' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSharedMailboxDto,
    @Req() req: any,
  ) {
    return this.sharedMailboxService.update(id, dto, req.user.email);
  }

  @Delete(':id')
  @AuditAction('Vô hiệu hóa Shared Mailbox')
  @ApiOperation({ summary: 'Vô hiệu hóa Shared Mailbox' })
  async disable(@Param('id') id: string, @Req() req: any) {
    return this.sharedMailboxService.disable(id, req.user.email);
  }

  @Post(':id/restore')
  @AuditAction('Khôi phục Shared Mailbox')
  @ApiOperation({ summary: 'Khôi phục Shared Mailbox' })
  async restore(@Param('id') id: string, @Req() req: any) {
    return this.sharedMailboxService.restore(id, req.user.email);
  }

  @Delete(':id/permanent')
  @AuditAction('Xóa vĩnh viễn Shared Mailbox')
  @ApiOperation({ summary: 'Xóa vĩnh viễn Shared Mailbox' })
  async permanentDelete(@Param('id') id: string, @Req() req: any) {
    return this.sharedMailboxService.permanentDelete(id, req.user.email);
  }

  @Post(':id/members')
  @AuditAction('Thêm thành viên Shared Mailbox')
  @ApiOperation({ summary: 'Thêm thành viên vào Shared Mailbox' })
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddSharedMailboxMemberDto,
    @Req() req: any,
  ) {
    return this.sharedMailboxService.addMember(id, dto, req.user.email);
  }

  @Delete(':id/members/:userId')
  @AuditAction('Xóa thành viên Shared Mailbox')
  @ApiOperation({ summary: 'Xóa thành viên khỏi Shared Mailbox' })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.sharedMailboxService.removeMember(id, userId, req.user.email);
  }
}
