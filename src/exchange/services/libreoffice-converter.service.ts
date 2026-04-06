import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { join, parse } from 'path';

@Injectable()
export class LibreOfficeConverterService {
  private readonly logger = new Logger(LibreOfficeConverterService.name);
  private readonly sofficePath =
    process.env.SOFFICE_PATH ||
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
  private readonly cacheRoot = join(tmpdir(), 'webmail-preview-cache');
  private queue: Promise<unknown> = Promise.resolve();

  private toLibreOfficeFileUrl(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    return `file:///${normalized}`;
  }

  private async ensureCacheRoot(): Promise<void> {
    await fs.mkdir(this.cacheRoot, { recursive: true });
  }

  private getCacheKey(filename: string, content: Buffer): string {
    return createHash('sha1')
      .update(filename)
      .update(content)
      .digest('hex');
  }

  private runSoffice(
    inputPath: string,
    outputDir: string,
    profileDir: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        this.sofficePath,
        [
          '--headless',
          '--nologo',
          '--nodefault',
          '--norestore',
          '--nolockcheck',
          `-env:UserInstallation=${this.toLibreOfficeFileUrl(profileDir)}`,
          '--convert-to',
          'pdf',
          '--outdir',
          outputDir,
          inputPath,
        ],
        { windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                stderr?.trim() ||
                  stdout?.trim() ||
                  error.message ||
                  'LibreOffice convert failed',
              ),
            );
            return;
          }

          resolve();
        },
      );
    });
  }

  private async convertInternal(
    filename: string,
    content: Buffer,
    cachePath: string,
  ): Promise<Buffer> {
    const extension = parse(filename || '').ext || '.pptx';
    const tempRoot = await fs.mkdtemp(join(tmpdir(), 'webmail-preview-'));
    const inputPath = join(tempRoot, filename || `attachment${extension}`);
    const outputDir = join(tempRoot, 'out');
    const profileDir = join(tempRoot, 'lo-profile');

    try {
      await fs.mkdir(outputDir, { recursive: true });
      await fs.mkdir(profileDir, { recursive: true });
      await fs.writeFile(inputPath, content);
      await this.runSoffice(inputPath, outputDir, profileDir);

      const outputPath = join(outputDir, `${parse(inputPath).name}.pdf`);
      const pdfContent = await fs.readFile(outputPath);

      await fs.writeFile(cachePath, pdfContent);
      return pdfContent;
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  }

  async convertToPdf(filename: string, content: Buffer): Promise<Buffer> {
    await this.ensureCacheRoot();

    const cacheKey = this.getCacheKey(filename, content);
    const cachePath = join(this.cacheRoot, `${cacheKey}.pdf`);

    try {
      const cached = await fs.readFile(cachePath);
      return cached;
    } catch {}

    const task = this.queue.then(() =>
      this.convertInternal(filename, content, cachePath),
    );

    this.queue = task
      .catch((error) => {
        this.logger.warn(`LibreOffice convert job failed: ${error.message}`);
      })
      .then(() => undefined);

    return task;
  }
}
