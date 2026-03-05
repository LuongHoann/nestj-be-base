import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // Updated scripts
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import * as path from 'path';

export type ScriptAction =
  | 'create'
  | 'update'
  | 'disable'
  | 'restore'
  | 'delete';

@Injectable()
export class ScriptRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScriptRunnerService.name);
  private readonly timeoutMs: number;

  private workerProcess: ChildProcess | null = null;
  private responseReader: readline.Interface | null = null;
  private pendingRequests: Map<
    number,
    { resolve: (value: any) => void; reject: (reason: any) => void; timer: NodeJS.Timeout }
  > = new Map();
  private requestCounter = 0;
  private isWorkerReady = false;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = this.configService.get<number>(
      'MAILBOX_SCRIPT_TIMEOUT_MS',
      120000,
    );
  }

  onModuleInit() {
    this.startWorker();
  }

  onModuleDestroy() {
    this.stopWorker();
  }

  private startWorker() {
    const workerPath = path.resolve('./scripts/mailbox/exchange-worker.py');
    const isWin = process.platform === 'win32';
    // Thử lần lượt các lệnh Python phổ biến
    const commandsToTry = isWin ? ['python', 'py', 'python3'] : ['python3', 'python'];
    
    this.trySpawnWorker(commandsToTry, workerPath);
  }

  private trySpawnWorker(cmds: string[], workerPath: string) {
    if (cmds.length === 0) {
      this.isWorkerReady = false;
      this.logger.error('❌ FATAL: Không tìm thấy lệnh Python nào (python, py, python3) trên hệ thống!');
      return;
    }

    const currentCmd = cmds[0];
    this.logger.log(`🚀 Đang khởi động Exchange Worker với: ${currentCmd}`);

    try {
      const child = spawn(currentCmd, [workerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      child.on('error', (err: any) => {
        if (err.code === 'ENOENT') {
          // Lệnh không tồn tại, thử lệnh tiếp theo trong danh sách
          this.trySpawnWorker(cmds.slice(1), workerPath);
        } else {
          this.logger.error(`❌ Worker process error (${currentCmd}): ${err.message}`);
          this.isWorkerReady = false;
        }
      });

      child.on('spawn', () => {
        this.workerProcess = child;
        this.isWorkerReady = true;
        this.logger.log(`✅ Exchange Worker đã khởi động thành công với: ${currentCmd}`);
        this.setupWorkerCommunication();
      });

      child.on('close', (code) => {
        if (this.isWorkerReady) {
          this.logger.warn(`⚠️ Exchange Worker đã thoát (code: ${code}). Tự khởi động lại sau 5s...`);
          this.isWorkerReady = false;
          this.cleanupWorker();
          setTimeout(() => this.startWorker(), 5000);
        }
      });
    } catch (error) {
      this.logger.error(`❌ Lỗi khi spawn worker: ${error.message}`);
      this.trySpawnWorker(cmds.slice(1), workerPath);
    }
  }

  private setupWorkerCommunication() {
    if (!this.workerProcess) return;

    this.responseReader = readline.createInterface({
      input: this.workerProcess.stdout!,
    });

    this.responseReader.on('line', (line) => {
      try {
        const response = JSON.parse(line);
        const firstKey = this.pendingRequests.keys().next().value;
        if (firstKey !== undefined) {
          const pending = this.pendingRequests.get(firstKey);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(firstKey);
            if (response.success) {
              pending.resolve({ stdout: response.message, stderr: '' });
            } else {
              pending.reject(new Error(response.message));
            }
          }
        }
      } catch (e) {
        this.logger.warn(`Lỗi phân giải kết quả worker: ${e.message}`);
      }
    });

    this.workerProcess.stderr?.on('data', (chunk) => {
      const msg = chunk.toString().trim();
      if (msg) this.logger.debug(`[Worker Debug]: ${msg}`);
    });
  }

  private cleanupWorker() {
    if (this.responseReader) {
      this.responseReader.close();
      this.responseReader = null;
    }
    // Reject all pending
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Worker connection closed'));
    }
    this.pendingRequests.clear();
  }

  private stopWorker() {
    this.isWorkerReady = false;
    if (this.workerProcess) {
      this.workerProcess.stdin?.end();
      this.workerProcess.kill();
      this.workerProcess = null;
    }
    this.cleanupWorker();
  }

  async run(action: ScriptAction, payload: Record<string, any>): Promise<{ stdout: string; stderr: string }> {
    if (!this.isWorkerReady || !this.workerProcess) {
      throw new Error('Exchange Worker chưa sẵn sàng. Vui lòng đợi trong giây lát.');
    }

    return new Promise((resolve, reject) => {
      const requestId = ++this.requestCounter;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Thao tác Mailbox (${action}) bị quá hạn sau ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      const enrichedPayload = {
        action,
        ...payload,
        ExchangeServer: this.configService.get('EXCHANGE_SERVER') || 'mail-ex.mailex.local',
        UserAdmin: this.configService.get('EXCHANGE_USER_ADMIN') || 'mailex\\Administrator',
        AdminPassword: this.configService.get('EXCHANGE_PASSWORD') || '123456a@',
      };

      try {
        this.workerProcess!.stdin!.write(JSON.stringify(enrichedPayload) + '\n');
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        reject(new Error(`Lỗi gửi lệnh tới worker: ${error.message}`));
      }
    });
  }
}
