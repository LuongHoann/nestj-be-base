import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMailboxDto {
  @ApiProperty({ example: 'user@domain.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'User Name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Temp@123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class UpdateMailboxDto {
  @ApiProperty({ example: 'User Name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'user@domain.local', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ImportMailboxDto {
  @ApiProperty({ example: 'email,name,password\nuser@domain.local,User Name,Temp@123' })
  @IsString()
  @IsNotEmpty()
  csv!: string;
}
