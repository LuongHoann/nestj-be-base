import {
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreatePostDto {
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  @IsOptional()
  title?: string;

  @IsString({ message: 'Nội dung phải là chuỗi' })
  @IsOptional()
  content?: string;

  @IsNotEmpty({ message: 'Tác giả không được để trống' })
  author: number;
}
