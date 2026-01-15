import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ItemsService } from '../services/items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get(':collection')
  async findMany(@Param('collection') collection: string, @Query() query: any) {
    return this.itemsService.findMany(collection, query);
  }

  @Get(':collection/:id')
  async findOne(
      @Param('collection') collection: string, 
      @Param('id') id: string,
      @Query() query: any
  ) {
    // Attempt parse ID as number if possible, or keep string
    const parsedId = !isNaN(Number(id)) ? Number(id) : id;
    return this.itemsService.findOne(collection, parsedId, query);
  }

  @Post(':collection')
  async create(@Param('collection') collection: string, @Body() body: any) {
    return this.itemsService.create(collection, body);
  }

  @Patch(':collection/:id')
  async update(
      @Param('collection') collection: string, 
      @Param('id') id: string, 
      @Body() body: any
  ) {
    const parsedId = !isNaN(Number(id)) ? Number(id) : id;
    return this.itemsService.update(collection, parsedId, body);
  }

  @Delete(':collection/:id')
  async delete(
      @Param('collection') collection: string, 
      @Param('id') id: string
  ) {
    const parsedId = !isNaN(Number(id)) ? Number(id) : id;
    return this.itemsService.delete(collection, parsedId);
  }
}
