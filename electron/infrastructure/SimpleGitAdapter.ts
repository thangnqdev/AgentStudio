import { promisify } from 'node:util';
import { exec } from 'node:child_process';

const execAsync = promisify(exec);

export class SimpleGitAdapter {
  async getBranch(workspacePath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: workspacePath });
      return stdout.trim();
    } catch {
      return null;
    }
  }
}

export const gitAdapter = new SimpleGitAdapter();
