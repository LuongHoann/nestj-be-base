import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GalService } from './gal.service';
import { MailboxService } from './mailbox.service';
import {
  CreateMailboxDto,
  ImportMailboxDto,
  UpdateMailboxDto,
} from './mailbox.dto';
import { ExchangeAuthGuard } from 'src/auth/guards/exchange-auth.guard';

@ApiTags('Mailbox')
@Controller('mailbox')
@UseGuards(ExchangeAuthGuard)
export class MailboxController {
  constructor(
    private readonly mailboxService: MailboxService,
    private readonly galService: GalService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List users/mailboxes' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'search', required: false })
  async list(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('search') search?: string,
  ) {
    return this.mailboxService.list(Number(page), Number(pageSize), search);
  }

  @Post()
  @ApiOperation({ summary: 'Create user/mailbox' })
  @ApiBody({ type: CreateMailboxDto })
  async create(@Body() dto: CreateMailboxDto) {
    return this.mailboxService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user/mailbox' })
  @ApiBody({ type: UpdateMailboxDto })
  async update(@Param('id') id: string, @Body() dto: UpdateMailboxDto) {
    return this.mailboxService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Disable user/mailbox' })
  async remove(@Param('id') id: string) {
    return this.mailboxService.remove(id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore user/mailbox' })
  async restore(@Param('id') id: string) {
    return this.mailboxService.restore(id);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Permanently delete user/mailbox' })
  async destroy(@Param('id') id: string) {
    return this.mailboxService.destroy(id);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import users/mailboxes from CSV' })
  @ApiBody({ type: ImportMailboxDto })
  async importCsv(@Body() dto: ImportMailboxDto) {
    return this.mailboxService.importCsv(dto.csv);
  }

  @Get('gal/search')
  @ApiOperation({ summary: 'Search GAL via EWS' })
  @ApiQuery({ name: 'q', required: true })
  async galSearch(@Query('q') q: string) {
    return this.galService.search(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user/mailbox detail' })
  async get(@Param('id') id: string) {
    return this.mailboxService.get(id);
  }

  @Post('sync/:id')
  @ApiOperation({ summary: 'Sync mailbox for user' })
  @ApiBody({ schema: { properties: { password: { type: 'string' } } } })
  async sync(@Param('id') id: string, @Body('password') password?: string) {
    return this.mailboxService.sync(id, password);
  }
}
