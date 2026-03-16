import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export type SharedMailboxAction =
  | 'create'
  | 'update'
  | 'disable'
  | 'restore'
  | 'delete'
  | 'add-permission'
  | 'remove-permission';

@Injectable()
export class SharedMailboxScriptRunner {
  private readonly logger = new Logger(SharedMailboxScriptRunner.name);
  private readonly timeoutMs: number;
  private readonly scriptsPath: string;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = this.configService.get<number>('MAILBOX_SCRIPT_TIMEOUT_MS', 120000);
    this.scriptsPath = path.resolve('./scripts/shared-mailbox');
  }

  async run(action: SharedMailboxAction, payload: Record<string, any>): Promise<any> {
    const scriptMap: Record<SharedMailboxAction, string> = {
      'create': 'create-shared-mailbox.ps1',
      'update': 'update-shared-mailbox.ps1',
      'disable': 'disable-shared-mailbox.ps1',
      'restore': 'update-shared-mailbox.ps1', // Reuse update or create restore script if needed, here just set active
      'delete': 'delete-shared-mailbox.ps1',
      'add-permission': 'add-mailbox-permission.ps1',
      'remove-permission': 'remove-mailbox-permission.ps1',
    };

    const scriptName = scriptMap[action];
    if (!scriptName) {
      throw new Error(`Unsupported action: ${action}`);
    }

    const scriptPath = path.join(this.scriptsPath, scriptName);
    
    // Convert payload to JSON string and escape quotes for PowerShell
    const jsonPayload = JSON.stringify(payload).replace(/"/g, '\\"');
    
    // Command to execute PowerShell script (use pwsh on Linux/Standard, powershell.exe as fallback on Win)
    const isWin = process.platform === 'win32';
    const shellCommand = isWin ? 'powershell.exe' : 'pwsh';
    const command = `${shellCommand} -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -InputJson "${jsonPayload}"`;

    this.logger.debug(`Executing PowerShell script via ${shellCommand}: ${scriptName}`);

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: this.timeoutMs });

      if (stderr) {
        this.logger.warn(`PowerShell Stderr (${scriptName}): ${stderr}`);
      }

      // Try to parse JSON output
      try {
        const result = JSON.parse(stdout.trim());
        if (!result.Success && result.Success !== true) {
           throw new Error(result.Error || 'Unknown error occurred in Script');
        }
        return result;
      } catch (parseError) {
        this.logger.error(`Failed to parse PowerShell JSON Output: ${stdout}`);
        throw new Error(`Invalid JSON response from Exchange script: ${parseError.message}`);
      }

    } catch (error) {
       this.logger.error(`Execution failed for ${scriptName}: ${error.message}`);
       throw error;
    }
  }
}
