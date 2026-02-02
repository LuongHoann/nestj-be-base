import { IsString, IsEmail, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class ExchangeLoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class SendMailDto {
    @IsArray()
    @IsEmail({}, { each: true })
    to!: string[];

    @IsString()
    subject!: string;

    @IsString()
    htmlBody!: string;

    @IsArray()
    @IsOptional()
    @IsEmail({}, { each: true })
    cc?: string[];
}
