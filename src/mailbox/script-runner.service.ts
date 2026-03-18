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
  private readonly workerEnabled: boolean;

  private workerProcess: ChildProcess | null = null;
  private responseReader: readline.Interface | null = null;
  private pendingRequests: Map<
    number,
    { resolve: (value: any) => void; reject: (reason: any) => void; timer: NodeJS.Timeout }
  > = new Map();
  private requestCounter = 0;
  private isWorkerReady = false;
  private workerCommand: string | null = null;
  private restartTimer: NodeJS.Timeout | null = null;
  private pythonMissingDetected = false;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = this.configService.get<number>(
      'MAILBOX_SCRIPT_TIMEOUT_MS',
      120000,
    );
    this.workerEnabled =
      this.configService.get<string>('MAILBOX_WORKER_ENABLED') !== 'false';
  }

  onModuleInit() {
    if (!this.workerEnabled) {
      this.logger.log('Mailbox worker is disabled by configuration');
      return;
    }

    void this.startWorker();
  }

  onModuleDestroy() {
    this.stopWorker();
  }

  private async startWorker() {
    if (!this.workerEnabled || this.workerProcess) {
      return;
    }

    const workerPath = path.resolve('./scripts/mailbox/exchange-worker.py');
    const isWin = process.platform === 'win32';
    const configuredCommand = this.configService.get<string>('MAILBOX_PYTHON_CMD');
    const commandsToTry = configuredCommand
      ? [configuredCommand]
      : isWin
        ? ['py', 'python', 'python3']
        : ['python3', 'python'];

    const resolvedCommand = await this.resolvePythonCommand(commandsToTry);
    if (!resolvedCommand) {
      this.logger.warn(
        'Mailbox worker is disabled because no usable Python interpreter was found',
      );
      return;
    }

    this.workerCommand = resolvedCommand;
    this.trySpawnWorker(resolvedCommand, workerPath);
  }

  private trySpawnWorker(currentCmd: string, workerPath: string) {
    this.pythonMissingDetected = false;
    this.logger.log(`🚀 Đang khởi động Exchange Worker với: ${currentCmd}`);

    try {
      const child = spawn(currentCmd, [workerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      child.on('error', (err: any) => {
        this.logger.error(`❌ Worker process error (${currentCmd}): ${err.message}`);
        this.isWorkerReady = false;
      });

      child.on('spawn', () => {
        this.workerProcess = child;
        this.isWorkerReady = true;
        this.logger.log(`✅ Exchange Worker đã khởi động thành công với: ${currentCmd}`);
        this.setupWorkerCommunication();
      });

      child.on('close', (code) => {
        const missingPython = this.pythonMissingDetected || code === 9009;
        const wasReady = this.isWorkerReady;

        this.isWorkerReady = false;
        this.workerProcess = null;
        this.cleanupWorker();

        if (missingPython) {
          this.logger.error(
            `Mailbox worker disabled because Python is not available for command '${currentCmd}'`,
          );
          return;
        }

        if (wasReady) {
          this.logger.warn(`⚠️ Exchange Worker đã thoát (code: ${code}). Tự khởi động lại sau 5s...`);
          this.restartTimer = setTimeout(() => {
            this.restartTimer = null;
            void this.startWorker();
          }, 5000);
        }
      });
    } catch (error) {
      this.logger.error(`❌ Lỗi khi spawn worker: ${error.message}`);
    }
  }

  private async resolvePythonCommand(commands: string[]): Promise<string | null> {
    for (const command of commands) {
      const isUsable = await this.isPythonCommandUsable(command);
      if (isUsable) {
        return command;
      }
    }

    return null;
  }

  private isPythonCommandUsable(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const probe = spawn(command, ['--version'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';

      probe.stdout?.on('data', (chunk) => {
        output += chunk.toString();
      });

      probe.stderr?.on('data', (chunk) => {
        output += chunk.toString();
      });

      probe.on('error', () => resolve(false));
      probe.on('close', (code) => {
        const normalized = output.toLowerCase();
        const missingAlias =
          normalized.includes('python was not found') ||
          normalized.includes('microsoft store') ||
          normalized.includes('app execution aliases');
        resolve(code === 0 && normalized.includes('python') && !missingAlias);
      });
    });
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
      if (!msg) {
        return;
      }

      const normalized = msg.toLowerCase();
      if (
        normalized.includes('python was not found') ||
        normalized.includes('microsoft store') ||
        normalized.includes('app execution aliases')
      ) {
        this.pythonMissingDetected = true;
      }

      this.logger.debug(`[Worker Debug]: ${msg}`);
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
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
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
