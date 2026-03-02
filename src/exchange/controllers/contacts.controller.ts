import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ExchangeAuthGuard } from 'src/auth/guards/exchange-auth.guard';
import { ContactNoteService } from '../services/contact-note.service';
import { CreateContactDto, UpdateContactDto } from '../dto/contact-note.dto';

@ApiTags('Contacts')
@Controller('webmail/contacts')
@UseGuards(ExchangeAuthGuard)
export class ContactsController {
  constructor(private readonly contactNoteService: ContactNoteService) {}

  @Post()
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Create contact' })
  @ApiBody({ type: CreateContactDto })
  async createContact(@Body() dto: CreateContactDto) {
    return this.contactNoteService.createContact(dto);
  }

  @Put(':id')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Update contact' })
  @ApiBody({ type: UpdateContactDto })
  async updateContact(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactNoteService.updateContact(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Delete contact' })
  async deleteContact(@Param('id') id: string) {
    return this.contactNoteService.deleteContact(id);
  }

  @Get('by-email')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Get contact by email' })
  @ApiQuery({ name: 'email', required: true })
  async getContactByEmail(@Query('email') email: string) {
    return this.contactNoteService.getContactByEmail(email);
  }

  @Get('count')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Get contacts count' })
  async getContactsCount() {
    return this.contactNoteService.getContactsCount();
  }

  @Get(':id')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Get contact by id' })
  @ApiParam({ name: 'id', required: true })
  async getContactById(@Param('id') id: string) {
    return this.contactNoteService.getContactById(id);
  }

  @Get()
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Search contacts' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async searchContacts(
    @Query('q') q: string = '',
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.contactNoteService.searchContacts(q, Number(page), Number(pageSize));
  }
}
