import { IsString, IsEmail, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExchangeLoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'P@ssw0rd123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class AttachmentDto {
  @ApiProperty({ example: 'report.pdf' })
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @ApiProperty({ example: 'application/pdf', required: false })
  @IsString()
  @IsOptional()
  contentType?: string;

  @ApiProperty({ example: 'BASE64_ENCODED_CONTENT' })
  @IsString()
  @IsNotEmpty()
  content!: string; // Base64 encoded content
}

export class SendMailDto {
  @ApiProperty({ example: ['to@example.com'] })
  @IsArray()
  @IsEmail({}, {
    each: true,
    message: 'Thong tin nguoi nhan khong hop le!'
  })
  to!: string[];

  @ApiProperty({ example: ['cc@example.com'], required: false })
  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true, message: 'Thong tin CC khong hop le!' })
  cc?: string[];

  @ApiProperty({ example: ['bcc@example.com'], required: false })
  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true, message: 'Thong tin BCC khong hop le!' })
  bcc?: string[];

  @ApiProperty({ example: ['reply@example.com'], required: false })
  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true, message: 'Thong tin Reply-To khong hop le!' })
  replyTo?: string[];

  @ApiProperty({ example: 'Tieu de email' })
  @IsString()
  @IsNotEmpty({ message: 'Tieu de email khong duoc de trong!' })
  subject!: string;

  @ApiProperty({ example: 'Noi dung text', required: false })
  @IsString()
  @IsOptional()
  text?: string; // Plain text version

  @ApiProperty({ example: '<p>Noi dung HTML</p>', required: false })
  @IsString()
  @IsOptional()
  html?: string; // HTML version

  @ApiProperty({ type: [AttachmentDto], required: false })
  @IsArray()
  @IsOptional()
  attachments?: AttachmentDto[];
}

export class SaveDraftDto {
  @ApiProperty({ example: ['to@example.com'], required: false })
  @IsArray()
  @IsOptional()
  @IsEmail({}, {
    each: true,
    message: 'Thong tin nguoi nhan khong hop le!'
  })
  to?: string[];

  @ApiProperty({ example: ['cc@example.com'], required: false })
  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true, message: 'Thong tin CC khong hop le!' })
  cc?: string[];

  @ApiProperty({ example: ['bcc@example.com'], required: false })
  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true, message: 'Thong tin BCC khong hop le!' })
  bcc?: string[];

  @ApiProperty({ example: ['reply@example.com'], required: false })
  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true, message: 'Thong tin Reply-To khong hop le!' })
  replyTo?: string[];

  @ApiProperty({ example: 'Tieu de email', required: false })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({ example: 'Noi dung text', required: false })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiProperty({ example: '<p>Noi dung HTML</p>', required: false })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiProperty({ type: [AttachmentDto], required: false })
  @IsArray()
  @IsOptional()
  attachments?: AttachmentDto[];
}

export class MoveMailDto {
  @ApiProperty({ example: 'SU5CT1g6MTIzNDU=' })
  @IsString()
  @IsNotEmpty()
  messageId!: string;

  @ApiProperty({ example: 'trash' })
  @IsString()
  @IsNotEmpty()
  targetFolder!: string;
}

export class MarkReadDto {
  @ApiProperty({ example: ['SU5CT1g6MTIzNDU='], required: false })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  all?: boolean;

  @ApiProperty({ example: true })
  @IsNotEmpty()
  isRead!: boolean;

  @ApiProperty({ example: 'inbox', required: false })
  @IsString()
  @IsOptional()
  folder?: string;
}

export class MoveBatchDto {
  @ApiProperty({ example: ['SU5CT1g6MTIzNDU='], required: false })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  all?: boolean;

  @ApiProperty({ example: 'spam', required: false })
  @IsString()
  @IsOptional()
  sourceFolder?: string;

  @ApiProperty({ example: 'trash' })
  @IsString()
  @IsNotEmpty()
  targetFolder!: string;
}

export class PermanentDeleteMailDto {
  @ApiProperty({ example: 'SU5CT1g6MTIzNDU=', required: false })
  @IsString()
  @IsOptional()
  messageId?: string;

  @ApiProperty({ example: ['SU5CT1g6MTIzNDU='], required: false })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  ids?: string[];

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  all?: boolean;

  @ApiProperty({ example: 'trash', required: false })
    @IsString()
    @IsOptional()
    sourceFolder?: string;
}

export class StarMailDto {
    @ApiProperty({ example: ['SU5CT1g6MTIzNDU='], required: false })
    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    ids?: string[];

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    all?: boolean;

    @ApiProperty({ example: 'inbox', required: false })
    @IsString()
    @IsOptional()
    folder?: string;
}

/** DTO dùng cho API trả lời thư (Reply / Reply All) */
export class ReplyMailDto {
  @ApiProperty({ example: 'SU5CT1g6MTIzNDU=', description: 'ID của thư gốc cần trả lời' })
  @IsString()
  @IsNotEmpty({ message: 'messageId không được để trống!' })
  messageId!: string;

  @ApiProperty({ example: '<p>Nội dung trả lời</p>', required: false })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiProperty({ example: 'Nội dung trả lời dạng text', required: false })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiProperty({ example: true, required: false, description: 'true = reply all, false = reply to sender only' })
  @IsOptional()
  replyAll?: boolean;

  @ApiProperty({ type: [AttachmentDto], required: false })
  @IsArray()
  @IsOptional()
  attachments?: AttachmentDto[];
}

/** DTO dùng cho API chuyển tiếp thư (Forward) */
export class ForwardMailDto {
  @ApiProperty({ example: 'SU5CT1g6MTIzNDU=', description: 'ID của thư gốc cần chuyển tiếp' })
  @IsString()
  @IsNotEmpty({ message: 'messageId không được để trống!' })
  messageId!: string;

  @ApiProperty({ example: ['forwardto@example.com'], description: 'Danh sách người nhận chuyển tiếp' })
  @IsArray()
  @IsEmail({}, { each: true, message: 'Thông tin người nhận không hợp lệ!' })
  to!: string[];

  @ApiProperty({ example: ['cc@example.com'], required: false })
  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true })
  cc?: string[];

  @ApiProperty({ example: ['bcc@example.com'], required: false })
  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true })
  bcc?: string[];

  @ApiProperty({ example: '<p>Nội dung ghi thêm khi forward</p>', required: false })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiProperty({ example: 'Nội dung ghi thêm dạng text', required: false })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiProperty({ type: [AttachmentDto], required: false })
  @IsArray()
  @IsOptional()
  attachments?: AttachmentDto[];
}
