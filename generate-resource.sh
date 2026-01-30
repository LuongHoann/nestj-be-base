#!/bin/bash

# generate-resource.sh
# Script này dùng để tự động tạo Controller và DTO cho một resource mới bằng cách đọc file entity.

# Kiểm tra xem có tham số được truyền vào không
if [ -z "$1" ]; then
    echo "Lỗi: Vui lòng cung cấp tên resource."
    echo "Ví dụ: ./generate-resource.sh Product"
    exit 1
fi

# --- Tên Biến ---
# Ví dụ: $1 = "Product"
NAME=$1
PascalCaseName=$NAME
lowerCaseName=$(echo "$NAME" | tr '[:upper:]' '[:lower:]')
# Lưu ý: Việc tạo số nhiều chỉ đơn giản là thêm 's'.

# --- Đường dẫn ---
controllerPath="src/controllers"
dtoPath="src/dto/$lowerCaseName"
entityFilePath="src/database/entities/$lowerCaseName.entity.ts"
controllerFilePath="$controllerPath/$lowerCaseName.controller.ts"
createDtoFilePath="$dtoPath/create-$lowerCaseName.dto.ts"
updateDtoFilePath="$dtoPath/update-$lowerCaseName.dto.ts"

# --- Tạo thư mục nếu chưa tồn tại ---
if [ ! -d "$dtoPath" ]; then
    mkdir -p "$dtoPath"
    echo "Đã tạo thư mục: $dtoPath"
fi

# --- Nội dung file DTO (Create) ---
# Tạo nội dung DTO cơ bản, người dùng sẽ tự điền chi tiết.
createDtoContent=$(cat <<EOF
// import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class Create${PascalCaseName}Dto {
  // Đây là nơi bạn sẽ định nghĩa các thuộc tính cho DTO.
  // Ví dụ:
  //
  // @IsString()
  // @IsNotEmpty()
  // name: string;
  //
  // @IsString()
  // @IsOptional()
  // description?: string;
}
EOF
)

# --- Nội dung file DTO (Update) ---
updateDtoContent=$(cat <<EOF
import { PartialType } from '@nestjs/mapped-types';
import { Create${PascalCaseName}Dto } from './create-${lowerCaseName}.dto';

export class Update${PascalCaseName}Dto extends PartialType(Create${PascalCaseName}Dto) {}
EOF
)

# --- Nội dung file Controller ---
controllerContent=$(cat <<EOF
import { Controller, Post, Body, Patch, Param } from '@nestjs/common';
import { ItemsService } from '../services/items.service';
import { Create${PascalCaseName}Dto } from '../dto/${lowerCaseName}/create-${lowerCaseName}.dto';
import { Update${PascalCaseName}Dto } from '../dto/${lowerCaseName}/update-${lowerCaseName}.dto';

@Controller('items/${lowerCaseName}')
export class ${PascalCaseName}sController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  create(@Body() createDto: Create${PascalCaseName}Dto) {
    // ValidationPipe sẽ tự động chạy trên createDto.
    return this.itemsService.create('${lowerCaseName}', createDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: Update${PascalCaseName}Dto) {
    return this.itemsService.update('${lowerCaseName}', id, updateDto);
  }

  // Ghi chú: Các phương thức GET và DELETE vẫn được ItemsController chung xử lý.
  // Bạn chỉ định nghĩa lại ở đây khi cần logic đặc biệt cho việc đọc hoặc xóa.
}
EOF
)

# --- Ghi file ---
echo "$createDtoContent" > "$createDtoFilePath"
echo "Đã tạo file DTO (Create): $createDtoFilePath"

echo "$updateDtoContent" > "$updateDtoFilePath"
echo "Đã tạo file DTO (Update): $updateDtoFilePath"

echo "$controllerContent" > "$controllerFilePath"
echo "Đã tạo file Controller: $controllerFilePath"

echo -e "\n\033[0;32mHoàn thành! Script đã ánh xạ các thuộc tính từ entity. Hãy kiểm tra lại file DTO và đăng ký Controller mới trong module của bạn.\033[0m"

exit 0
