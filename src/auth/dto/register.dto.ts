import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'P@ssw0rd123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Nguyen Van A', required: false })
  @IsString()
  @IsOptional()
  name?: string;
}
