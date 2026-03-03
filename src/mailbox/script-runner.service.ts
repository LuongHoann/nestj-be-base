import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';

export type ScriptAction =
  | 'create'
  | 'update'
  | 'disable'
  | 'restore'
  | 'delete';

@Injectable()
export class ScriptRunnerService {
  private readonly logger = new Logger(ScriptRunnerService.name);
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = this.configService.get<number>(
      'MAILBOX_SCRIPT_TIMEOUT_MS',
      60000,
    );
  }

  async run(
    action: ScriptAction,
    payload: Record<string, any>,
  ): Promise<{ stdout: string; stderr: string }> {
    const scriptPath = this.getScriptPath(action);
    if (!scriptPath) {
      throw new Error(`Script path not configured for action ${action}`);
    }

    return new Promise((resolve, reject) => {
      const { command, args } = this.buildCommand(scriptPath);
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Script timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          const message = stderr || stdout || `Script exited with code ${code}`;
          return reject(new Error(message));
        }
        resolve({ stdout, stderr });
      });

      try {
        const enrichedPayload = {
          ...payload,
          ExchangeServer:
            this.configService.get<string>('EXCHANGE_SERVER') ||
            'mail-ex.mailex.local',
          UserAdmin:
            this.configService.get<string>('EXCHANGE_USER_ADMIN') ||
            'mailex\\Administrator',
          Password:
            this.configService.get<string>('EXCHANGE_PASSWORD') || '123456a@',
        };
        child.stdin.write(JSON.stringify(enrichedPayload));
        child.stdin.end();
      } catch (error) {
        this.logger.warn(`Failed to write to script stdin: ${error.message}`);
      }
    });
  }

  private getScriptPath(action: ScriptAction): string | undefined {
    switch (action) {
      case 'create':
        return this.configService.get<string>('MAILBOX_SCRIPT_CREATE');
      case 'update':
        return this.configService.get<string>('MAILBOX_SCRIPT_UPDATE');
      case 'disable':
        return this.configService.get<string>('MAILBOX_SCRIPT_DISABLE');
      case 'restore':
        return this.configService.get<string>('MAILBOX_SCRIPT_RESTORE');
      case 'delete':
        return this.configService.get<string>('MAILBOX_SCRIPT_DELETE');
      default:
        return undefined;
    }
  }

  private buildCommand(scriptPath: string): {
    command: string;
    args: string[];
  } {
    if (scriptPath.toLowerCase().endsWith('.ps1')) {
      return {
        command: 'powershell',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      };
    }
    return { command: scriptPath, args: [] };
  }
}
