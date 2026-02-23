import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CommitFileDto {
  @ApiProperty({ example: '01KFQ3SQA8JEBXYGP6AZNJBNZ8' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'report.pdf', required: false })
  @IsOptional()
  @IsString()
  originalName?: string;

  @ApiProperty({ example: { category: 'contract' }, required: false })
  @IsOptional()
  @IsObject()
  extraMetadata?: Record<string, any>;
}
