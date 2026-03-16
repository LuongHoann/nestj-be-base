import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
} from 'class-validator';
import { SharedMailboxRole } from '../database/entities/shared-mailbox-member.entity';

export class CreateSharedMailboxDto {
  @ApiProperty({ example: 'support@domain.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'support' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Support Mailbox' })
  @IsString()
  @IsNotEmpty()
  displayName!: string;
}

export class UpdateSharedMailboxDto {
  @ApiProperty({ example: 'Support Mailbox 2', required: false })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({ example: 'support2@domain.local', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;
}

export class AddSharedMailboxMemberDto {
  @ApiProperty({ example: 'userA@domain.local', description: 'User email' })
  @IsEmail()
  @IsNotEmpty()
  userEmail!: string;

  @ApiProperty({ example: 'MEMBER', enum: SharedMailboxRole })
  @IsEnum(SharedMailboxRole)
  role: SharedMailboxRole = SharedMailboxRole.MEMBER;
}
