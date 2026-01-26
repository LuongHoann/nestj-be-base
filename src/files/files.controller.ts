import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  Res,
  Query,
  BadRequestException,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { CommitFileDto } from './dto/commit-file.dto';
import { TempUploadResponseDto } from './dto/temp-upload-response.dto';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * POST /files/upload
   * Upload file to temporary storage
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTemp(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<TempUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.filesService.uploadTemp(file);
  }

  /**
   * GET /files/temp/:id/preview
   * Stream temporary file for preview
   */
  @Get('temp/:id/preview')
  async previewTemp(@Param('id') id: string, @Res() res: Response) {
    const fileMetadata = await this.filesService.getMetadata(id);
    const stream = await this.filesService.getTempFileStream(id);

    // Set headers for inline preview with full info for Postman
    res.setHeader('Content-Type', fileMetadata.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileMetadata.originalName}"`,
    );
    res.setHeader('Content-Length', fileMetadata.size.toString());
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache for temp preview
    res.setHeader('Accept-Ranges', 'bytes');

    stream.pipe(res);
  }

  /**
   * POST /files/commit
   * Commit file from temp to permanent storage
   */
  @Post('commit')
  async commitFile(@Body() dto: CommitFileDto) {
    return this.filesService.commitFile(dto.id, dto.extraMetadata, dto.originalName);
  }

  /**
   * GET /files/:id
   * Get file metadata only (no streaming)
   */
  @Get(':id')
  async getFileMetadata(@Param('id') id: string) {
    const file = await this.filesService.getMetadata(id);

    // Convert bigint to string for JSON serialization
    return {
      ...file,
      size: file.size.toString(),
    };
  }
}

@Controller('assets')
export class AssetsController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * GET /assets/:id
   * Stream permanent file with Range support
   */
  @Get(':id')
  async streamAsset(
    @Param('id') id: string,
    @Query('download') download: string,
    @Res() res: Response,
  ) {
    const { file, stream } = await this.filesService.getFileStream(id);

    // Set Content-Disposition based on download parameter
    const disposition = download === 'true' ? 'attachment' : 'inline';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${file.originalName}"`,
    );

    // Set Content-Type
    res.setHeader('Content-Type', file.mimeType);

    // Set Content-Length
    res.setHeader('Content-Length', file.size.toString());

    // Set Cache-Control as requested
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache

    // Enable Range requests
    res.setHeader('Accept-Ranges', 'bytes');

    // For now, stream entire file (Range handling can be added here)
    stream.pipe(res);
  }
}
