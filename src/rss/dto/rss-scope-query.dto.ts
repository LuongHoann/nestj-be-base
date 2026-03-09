import { IsIn, IsOptional } from 'class-validator';

export class RssScopeQueryDto {
  @IsOptional()
  @IsIn(['server'])
  scope?: 'server';
}
