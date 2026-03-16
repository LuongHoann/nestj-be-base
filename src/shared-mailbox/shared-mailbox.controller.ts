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
import { SharedMailbox } from 'src/database/entities/shared-mailbox.entity';
import { ExchangeAuthGuard } from 'src/auth/guards/exchange-auth.guard';

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
    return this.sharedMailboxService.getForUser(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo Shared Mailbox mới' })
  async create(@Body() dto: CreateSharedMailboxDto, @Req() req: any) {
    return this.sharedMailboxService.create(dto, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết Shared Mailbox' })
  async get(@Param('id') id: string) {
    return this.sharedMailboxService.get(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin Shared Mailbox' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSharedMailboxDto,
    @Req() req: any,
  ) {
    return this.sharedMailboxService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Vô hiệu hóa Shared Mailbox' })
  async disable(@Param('id') id: string, @Req() req: any) {
    return this.sharedMailboxService.disable(id, req.user.id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Khôi phục Shared Mailbox' })
  async restore(@Param('id') id: string, @Req() req: any) {
    return this.sharedMailboxService.restore(id, req.user.id);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Xóa vĩnh viễn Shared Mailbox' })
  async permanentDelete(@Param('id') id: string, @Req() req: any) {
    return this.sharedMailboxService.permanentDelete(id, req.user.id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Thêm thành viên vào Shared Mailbox' })
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddSharedMailboxMemberDto,
    @Req() req: any,
  ) {
    return this.sharedMailboxService.addMember(id, dto, req.user.id);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Xóa thành viên khỏi Shared Mailbox' })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.sharedMailboxService.removeMember(id, userId, req.user.id);
  }
}
