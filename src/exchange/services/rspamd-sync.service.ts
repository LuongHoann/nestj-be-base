import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'ssh2';
import * as fs from 'fs';

@Injectable()
export class RspamdSyncService implements OnModuleInit {
  private readonly logger = new Logger(RspamdSyncService.name);
  
  private sshConfig: any;
  private rspamdLocalDPath: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('RSPAMD_SSH_HOST');
    const port = this.config.get<number>('RSPAMD_SSH_PORT', 22);
    const username = this.config.get<string>('RSPAMD_SSH_USER', 'root');
    const privateKeyPath = this.config.get<string>('RSPAMD_SSH_PRIVATE_KEY_PATH');
    const projectPath = this.config.get<string>('RSPAMD_PROJECT_PATH') || '/root/webmail_exchange/mail-gateway';
    
    this.rspamdLocalDPath = `${projectPath}/rspamd/local.d`;

    if (!host || !privateKeyPath) {
      this.logger.warn('RSPAMD_SSH_HOST or RSPAMD_SSH_PRIVATE_KEY_PATH is missing. SSH Sync will be offline.');
      return;
    }

    try {
      const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      this.sshConfig = {
        host,
        port,
        username,
        privateKey,
        readyTimeout: 10000,
      };
      this.logger.log(`RspamdSyncService configured for SSH to ${host}:${port} as ${username}. Target path: ${this.rspamdLocalDPath}`);
    } catch (err) {
      this.logger.error(`Failed to read SSH private key from ${privateKeyPath}: ${err.message}`);
    }
  }

  /**
   * Thực thi một lệnh qua SSH
   */
  private async execCommand(command: string): Promise<string> {
    if (!this.sshConfig) {
      throw new Error('SSH Service is not properly configured.');
    }

    return new Promise((resolve, reject) => {
      const conn = new Client();
      let output = '';
      let errorOutput = '';

      conn
        .on('ready', () => {
          this.logger.debug(`SSH Client ready. Executing: ${command}`);
          conn.exec(command, (err, stream) => {
            if (err) {
              conn.end();
              return reject(err);
            }
            stream
              .on('close', (code: any, signal: any) => {
                conn.end();
                if (code !== 0) {
                  return reject(new Error(`Command failed with code ${code}. Error: ${errorOutput}`));
                }
                resolve(output.trim());
              })
              .on('data', (data: any) => {
                output += data;
              })
              .stderr.on('data', (data: any) => {
                errorOutput += data;
              });
          });
        })
        .on('error', (err) => {
          this.logger.error(`SSH Connection Error: ${err.message}`);
          reject(err);
        })
        .connect(this.sshConfig);
    });
  }

  /**
   * Thêm một policy (domain/email) vào file cấu hình
   * Hàm này sẽ kiểm tra xem giá trị đã tồn tại chưa bằng grep trước khi thêm vào
   */
  async appendToPolicyFile(fileName: string, value: string): Promise<void> {
    const filePath = `${this.rspamdLocalDPath}/${fileName}`;
    // Kiểm tra đã tồn tại hay chưa, nếu chưa thì thêm mới vào.
    const command = `grep -q -F -x "${value}" ${filePath} || echo "${value}" >> ${filePath}`;
    await this.execCommand(command);
  }

  /**
   * Xoá một policy khỏi file cấu hình
   */
  async removeFromPolicyFile(fileName: string, value: string): Promise<void> {
    const filePath = `${this.rspamdLocalDPath}/${fileName}`;
    // Sử dụng sed để xoá chính xác dòng đó. Escape `/` nếu có trong chuỗi (ít gặp ở email/domain nhưng an toàn)
    const escapedValue = value.replace(/\//g, '\\/');
    const command = `sed -i '/^${escapedValue}$/d' ${filePath}`;
    await this.execCommand(command);
  }

  /**
   * Sync toàn bộ mảng dữ liệu đè vào file (dành cho Force Sync)
   */
  async syncFullFile(fileName: string, values: string[]): Promise<void> {
    const filePath = `${this.rspamdLocalDPath}/${fileName}`;
    // Ghi toàn bộ nội dung mảng thành chuỗi phân ranh bằng newline, dùng printf để ghi đè vào file
    const joined = values.join('\\n');
    const command = `printf "${joined}\\n" > ${filePath}`;
    await this.execCommand(command);
  }

  /**
   * Reload Rspamd (Apply thay đổi file map)
   */
  async reloadRspamd(): Promise<void> {
    const command = `docker exec -t rspamd rspamadm control reload`;
    try {
      await this.execCommand(command);
      this.logger.log('Reloaded rspamd successfully.');
    } catch (err) {
      this.logger.error(`Failed to reload rspamd: ${err.message}`);
      throw err;
    }
  }
}
