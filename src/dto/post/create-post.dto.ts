import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDefined } from 'class-validator';

export class CreatePostDto {
  @IsDefined({message: "Tiêu đề không được để trống"})
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @IsString({message: "Tiêu đề phải là chuỗi"})
  title: string;
  
  @IsString({message: "Nội dung phải là chuỗi"})
  @IsOptional()
  content?: string;

  @IsNotEmpty({message: "Tác giả không được để trống"})
  author: number;
}
