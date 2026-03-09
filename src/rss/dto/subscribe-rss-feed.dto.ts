import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class SubscribeRssFeedDto {
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}
