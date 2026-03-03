import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Nội dung sự kiện' })
  @IsString()
  body: string;

  @ApiProperty({ description: 'ISO 8601 Datetime string' })
  @IsString()
  start: string;

  @ApiProperty({ description: 'ISO 8601 Datetime string' })
  @IsString()
  end: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isAllDayEvent?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isReminderSet?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  reminderMinutesBeforeStart?: number;
}

export class UpdateEventDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  start?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  end?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isAllDayEvent?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isReminderSet?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  reminderMinutesBeforeStart?: number;
}
