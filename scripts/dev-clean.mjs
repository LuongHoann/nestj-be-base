import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const repoRootPattern = repoRoot.replace(/'/g, "''");
const currentPid = process.pid;

function runPowerShell(command) {
  return execFileSync('powershell', ['-NoProfile', '-Command', command], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function stopProcess(processId) {
  try {
    execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `Stop-Process -Id ${processId} -Force`],
      {
        cwd: repoRoot,
        stdio: 'ignore',
      },
    );
    console.log(`[dev-clean] Stopped stale backend process ${processId}.`);
  } catch {
    console.log(
      `[dev-clean] Skipped backend process ${processId}; it already exited.`,
    );
  }
}

function main() {
  if (process.platform !== 'win32') {
    return;
  }

  const command = [
    `$repo = '${repoRootPattern}';`,
    `$currentPid = ${currentPid};`,
    '$repoProcessIds = Get-CimInstance Win32_Process |',
    '  Where-Object {',
    "    $_.Name -eq 'node.exe' -and",
    '    $_.ProcessId -ne $currentPid -and',
    '    $_.CommandLine -like "*$repo*" -and',
    "    ($_.CommandLine -like '*@nestjs*' -or $_.CommandLine -like '*nest start*' -or $_.CommandLine -like '*dist\\src\\main*')",
    '  } |',
    '  Select-Object -ExpandProperty ProcessId;',
    '$portProcessIds = Get-NetTCPConnection -LocalPort 3005 -State Listen -ErrorAction SilentlyContinue |',
    '  ForEach-Object {',
    '    $procId = $_.OwningProcess;',
    '    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $procId";',
    '    if ($proc -and $proc.Name -eq \'node.exe\' -and $proc.CommandLine -like "*$repo*") { $procId }',
    '  };',
    '($repoProcessIds + $portProcessIds) | Sort-Object -Unique',
  ].join(' ');

  const output = runPowerShell(command);
  const processIds = output
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => /^\d+$/.test(value));

  for (const value of processIds) {
    stopProcess(value);
  }
}

try {
  main();
} catch (error) {
  console.error('[dev-clean] Failed to clean backend dev state.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
