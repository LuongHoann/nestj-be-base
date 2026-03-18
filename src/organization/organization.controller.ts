import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateOrganizationUnitDto, UpdateOrganizationUnitDto } from './organization.dto';
import { ExchangeAuthGuard } from '../auth/guards/exchange-auth.guard';

@ApiTags('Organization Units')
@ApiCookieAuth('exchange_session')
@ApiBearerAuth()
@UseGuards(ExchangeAuthGuard)
@Controller('api/organization-units')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get('tree')
  @ApiOperation({ summary: 'Lấy cấu trúc Cây Đơn vị (Phân quyền theo Admin)' })
  getTree(@Req() req: any) {
    const userEmail = req.user.email;
    return this.orgService.getTree(userEmail);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo mới Đơn vị / Phòng ban' })
  create(@Body() createDto: CreateOrganizationUnitDto, @Req() req: any) {
    const adminEmail = req.user.email;
    return this.orgService.create(createDto, adminEmail);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật Tên, Mã Đơn vị' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrganizationUnitDto,
    @Req() req: any,
  ) {
    const adminEmail = req.user.email;
    return this.orgService.update(id, updateDto, adminEmail);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa một Đơn vị / Phòng ban (Nếu không có Unit con)' })
  remove(@Param('id') id: string, @Req() req: any) {
    const adminEmail = req.user.email;
    return this.orgService.remove(id, adminEmail);
  }

  @Get('users/search')
  @ApiOperation({ summary: 'Tìm kiếm User theo Email (Auto-complete)' })
  @ApiQuery({ name: 'q', required: true, description: 'Từ khóa email' })
  searchUsers(@Query('q') q: string, @Req() req: any) {
    return this.orgService.searchUsers(q, req.user.email);
  }

  @Get(':id/users')
  @ApiOperation({ summary: 'Lấy các User thuộc về 1 Đơn vị cụ thể (Có phân trang)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  getUsersByUnit(
    @Param('id') unitId: string, 
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('search') search: string,
    @Req() req: any
  ) {
    return this.orgService.getUsersByUnit(
      unitId, 
      req.user.email,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 10,
      search
    );
  }

  @Patch('users/:userId/assign')
  @ApiOperation({ summary: 'Gán User vào Đơn vị / Phòng ban' })
  assignUser(
    @Param('userId') userId: string,
    @Body('orgUnitId') unitId: string | null,
    @Req() req: any
  ) {
    return this.orgService.assignUser(userId, unitId, req.user.email);
  }
}
