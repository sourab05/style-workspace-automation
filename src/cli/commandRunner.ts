import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

export interface CommandOptions {
  cwd: string;
  timeout: number;
  expectedFile?: string;
  successMessage?: string; // deprecated in favor of successPatterns
  successPatterns?: string[]; // settle success when any pattern is seen in stdout/stderr
  onData?: (data: string, child: ChildProcess) => void;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

/**
 * Run a shell command with robust error handling and monitoring
 */
export async function runCommand(
  command: string,
  options: CommandOptions
): Promise<CommandResult> {
  const { cwd, timeout, expectedFile, successMessage, successPatterns, onData } = options;
  
  console.log(`[Command] Executing: ${command}`);
  console.log(`[Command] Working directory: ${cwd}`);
  console.log(`[Command] Timeout: ${timeout / 60000} minutes`);

  let child: ChildProcess;

  return new Promise<CommandResult>((resolve, reject) => {
    const env = { ...process.env, CI: 'false', NO_COLOR: '1' };
    child = spawn(command, {
      shell: true,
      cwd,
      env,
      detached: true,
      stdio: 'pipe'
    });

    console.log(`[Command] Process spawned with PID: ${child.pid}`);

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeoutId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
      child.removeAllListeners();
    };

    const settle = (err: Error | null, result?: CommandResult) => {
      if (settled) return;
      settled = true;
      console.log(`[Command] Settling: ${err ? 'ERROR' : 'SUCCESS'}`);
      cleanup();
      
      if (err) {
        reject(err);
      } else {
        resolve(result!);
      }
    };

    // Set timeout
    timeoutId = setTimeout(() => {
      console.error(`[Command] TIMEOUT after ${timeout / 60000} minutes`);
      settle(new Error(`Command timed out after ${timeout / 60000} minutes`));
    }, timeout);

    // If expecting a file, poll for it
    if (expectedFile) {
      console.log(`[Command] Polling for file: ${expectedFile}`);
      let pollCount = 0;
      
      intervalId = setInterval(() => {
        pollCount++;
        try {
          if (fs.existsSync(expectedFile)) {
            console.log(`[Command] ✅ File found after ${pollCount} polls (${pollCount * 5}s)`);
            settle(null, { stdout, stderr });
          }
        } catch (error) {
          // Continue polling
        }
      }, 5000); // Poll every 5 seconds
    }

    // Helper to check success across streams
    const sawSuccess = (chunk: string): boolean => {
      if (successMessage && chunk.includes(successMessage)) return true;
      if (successPatterns && successPatterns.some(p => chunk.includes(p))) return true;
      return false;
    };

    // Handle stdout
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text); // Live stream

      // Custom data handler
      if (onData) {
        onData(text, child);
      }

      // Auto-handle prompts
      if (text.includes('Would you like to eject the expo project') ||
          text.includes('Would you like to empty the dest folder')) {
        console.log('[Command] Auto-responding: yes');
        child.stdin?.write('yes\n');
      }
      
      if (text.includes('Use port 8082 instead?') ||
          text.includes('Use port 8081 instead?')) {
        console.log('[Command] Auto-responding: y');
        child.stdin?.write('y\n');
      }

      // Check for success in stdout
      if (sawSuccess(text)) {
        console.log(`[Command] ✅ Success pattern found in stdout`);
        settle(null, { stdout, stderr });
      }
    });

    // Handle stderr
    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text); // Live stream

      // Check for success in stderr too
      if (sawSuccess(text)) {
        console.log(`[Command] ✅ Success pattern found in stderr`);
        settle(null, { stdout, stderr });
      }
    });

    // Handle process errors
    child.on('error', (error: Error) => {
      console.error(`[Command] Process error:`, error);
      settle(new Error(`Failed to start command: ${error.message}`));
    });

    // Handle process exit
    child.on('close', (code: number | null) => {
      console.log(`[Command] Process exited with code: ${code}`);
      
      if (!settled) {
        if (code !== 0) {
          settle(new Error(
            `Command failed with exit code ${code}\n` +
            `Stdout: ${stdout.slice(-500)}\n` +
            `Stderr: ${stderr.slice(-500)}`
          ));
        } else {
          // If waiting for a file and process exited, check once more
          if (expectedFile && !fs.existsSync(expectedFile)) {
            settle(new Error(
              `Command finished but expected file not found: ${expectedFile}`
            ));
          } else if (!successMessage && !expectedFile) {
            // No specific success criteria, consider success
            settle(null, { stdout, stderr });
          } else if (!(successMessage || (successPatterns && successPatterns.length))) {
            // No specific success criteria, consider success
            settle(null, { stdout, stderr });
          } else {
            // Was waiting for success, but didn't get it
            settle(new Error(
              'Process exited but success condition was not met'
            ));
          }
        }
      }
    });
  }).finally(() => {
    // Cleanup process tree
    if (child && child.pid) {
      console.log(`[Command] Cleaning up process tree (PID: ${child.pid})`);
      killProcessTree(child.pid);
    }
  });
}

/**
 * Kill a process and its entire descendant tree
 */
function killProcessTree(pid: number): void {
  try {
    if (os.platform() === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      // Kill the entire process group
      process.kill(-pid, 'SIGKILL');
    }
  } catch (error: any) {
    // Process may have already exited (ESRCH)
    if (error.code !== 'ESRCH') {
      console.error(`[Command] Failed to kill process tree:`, error.message);
    }
  }
}
