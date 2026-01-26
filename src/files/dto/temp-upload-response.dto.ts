export class TempUploadResponseDto {
  id!: string;
  originalName!: string;
  mimeType!: string;
  size!: number;
  previewUrl!: string;

  constructor(partial: Partial<TempUploadResponseDto>) {
    Object.assign(this, partial);
  }
}
