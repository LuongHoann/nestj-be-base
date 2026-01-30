import { Controller, Post, Body, Patch, Param } from '@nestjs/common';
import { ItemsService } from '../services/items.service';
import { CreatePostDto } from '../dto/post/create-post.dto';
import { UpdatePostDto } from '../dto/post/update-post.dto';

@Controller('items/posts')
export class PostsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  create(@Body() createDto: CreatePostDto) {
    // ValidationPipe sẽ tự động chạy trên createDto.
    console.log('check==')
    return this.itemsService.create('posts', createDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdatePostDto) {
    return this.itemsService.update('posts', id, updateDto);
  }

  // Ghi chú: Các phương thức GET và DELETE vẫn được ItemsController chung xử lý.
  // Bạn chỉ định nghĩa lại ở đây khi cần logic đặc biệt cho việc đọc hoặc xóa.
}
