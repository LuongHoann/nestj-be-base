import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { UnitLevel } from '../database/entities/organization-unit.entity';

export class CreateOrganizationUnitDto {
  @ApiProperty({ example: 'Phòng Kỹ thuật' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'KT01', required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ enum: UnitLevel })
  @IsEnum(UnitLevel)
  level!: UnitLevel;

  @ApiProperty({ description: 'ID của Đơn vị cha', required: false })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}

export class UpdateOrganizationUnitDto {
  @ApiProperty({ example: 'Phòng Công nghệ', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'CN01', required: false })
  @IsString()
  @IsOptional()
  code?: string;
}
