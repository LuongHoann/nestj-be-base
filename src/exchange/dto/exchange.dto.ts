import { IsString, IsEmail, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class ExchangeLoginDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class AttachmentDto {
    @IsString()
    @IsNotEmpty()
    filename!: string;

    @IsString()
    @IsOptional()
    contentType?: string;

    @IsString()
    @IsNotEmpty()
    content!: string; // Base64 encoded content
}

export class SendMailDto {
    @IsArray()
    @IsEmail({}, { 
        each: true,
        message: 'Thông tin người nhận không hợp lệ!'
    })
    to!: string[];

    @IsArray()
    @IsOptional()
    @IsEmail({}, { each: true, message: 'Thông tin CC không hợp lệ!' })
    cc?: string[];

    @IsArray()
    @IsOptional()
    @IsEmail({}, { each: true, message: 'Thông tin BCC không hợp lệ!' })
    bcc?: string[];

    @IsArray()
    @IsOptional()
    @IsEmail({}, { each: true, message: 'Thông tin Reply-To không hợp lệ!' })
    replyTo?: string[];

    @IsString()
    @IsNotEmpty({ message: 'Tiêu đề email không được để trống!' })
    subject!: string;

    @IsString()
    @IsOptional()
    text?: string; // Plain text version

    @IsString()
    @IsOptional()
    html?: string; // HTML version

    @IsArray()
    @IsOptional()
    attachments?: AttachmentDto[];
}

export class MoveMailDto {
    @IsString()
    @IsNotEmpty()
    messageId!: string;

    @IsString()
    @IsNotEmpty()
    targetFolder!: string;
}

export class MarkReadDto {
    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    ids?: string[];

    @IsOptional()
    all?: boolean;

    @IsNotEmpty()
    isRead!: boolean;

    @IsString()
    @IsOptional()
    folder?: string;
}
