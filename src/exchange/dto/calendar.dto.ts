import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsISO8601,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Custom decorator: kiểm tra field hiện tại (end) phải sau field tham chiếu (start).
 * Dùng để đảm bảo end > start trước khi tạo / cập nhật sự kiện.
 */
function IsDateAfter(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDateAfter',
      target: (object as any).constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          if (!value || !relatedValue) return true; // bỏ qua nếu một trong hai rỗng
          // Cho phép end = start (event cả ngày trùng ngày), chỉ từ chối khi end < start
          return new Date(value).getTime() >= new Date(relatedValue).getTime();
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} phải sau ${args.constraints[0]}`;
        },
      },
    });
  };
}

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Nội dung sự kiện' })
  @IsString()
  body: string;

  @ApiProperty({ description: 'ISO 8601 Datetime string' })
  @IsISO8601({}, { message: 'start phải là ISO 8601 hợp lệ (VD: 2026-03-04T10:00:00.000Z)' })
  start: string;

  @ApiProperty({ description: 'ISO 8601 Datetime string' })
  @IsISO8601({}, { message: 'end phải là ISO 8601 hợp lệ' })
  @IsDateAfter('start', { message: 'Thời gian kết thúc phải sau thời gian bắt đầu' })
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
  @IsISO8601({}, { message: 'start phải là ISO 8601 hợp lệ' })
  @IsOptional()
  start?: string;

  @ApiPropertyOptional()
  @IsISO8601({}, { message: 'end phải là ISO 8601 hợp lệ' })
  @IsOptional()
  // Chỉ validate end > start khi cả hai đều được truyền vào
  @ValidateIf((o) => !!o.start && !!o.end)
  @IsDateAfter('start', { message: 'Thời gian kết thúc phải sau thời gian bắt đầu' })
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
