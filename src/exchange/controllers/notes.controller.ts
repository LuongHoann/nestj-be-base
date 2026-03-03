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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ExchangeAuthGuard } from 'src/auth/guards/exchange-auth.guard';
import { ContactNoteService } from '../services/contact-note.service';
import { CreateNoteDto, UpdateNoteDto } from '../dto/contact-note.dto';

@ApiTags('Notes')
@Controller('webmail/notes')
@UseGuards(ExchangeAuthGuard)
export class NotesController {
  constructor(private readonly contactNoteService: ContactNoteService) {}

  @Get()
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'List notes' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async listNotes(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.contactNoteService.listNotes(Number(page), Number(pageSize));
  }

  @Post()
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Create note' })
  @ApiBody({ type: CreateNoteDto })
  async createNote(@Body() dto: CreateNoteDto) {
    return this.contactNoteService.createNote(dto);
  }

  @Put(':id')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Update note' })
  @ApiBody({ type: UpdateNoteDto })
  async updateNote(@Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.contactNoteService.updateNote(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('exchange_cookie')
  @ApiOperation({ summary: 'Delete note' })
  async deleteNote(@Param('id') id: string) {
    return this.contactNoteService.deleteNote(id);
  }
}
