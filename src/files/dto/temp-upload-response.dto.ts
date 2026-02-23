import { ApiProperty } from '@nestjs/swagger';

export class TempUploadResponseDto {
  @ApiProperty({ example: '01KFQ3SQA8JEBXYGP6AZNJBNZ8' })
  id!: string;
  @ApiProperty({ example: 'report.pdf' })
  originalName!: string;
  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;
  @ApiProperty({ example: 123456 })
  size!: number;
  @ApiProperty({ example: '/files/temp/01KFQ3SQA8JEBXYGP6AZNJBNZ8/preview' })
  previewUrl!: string;

  constructor(partial: Partial<TempUploadResponseDto>) {
    Object.assign(this, partial);
  }
}
