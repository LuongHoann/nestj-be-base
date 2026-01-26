import { IsString, IsOptional, IsObject } from 'class-validator';

export class CommitFileDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  originalName?: string;

  @IsOptional()
  @IsObject()
  extraMetadata?: Record<string, any>;
}
