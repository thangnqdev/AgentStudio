import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

type GitCommandRunner = (file: string, args: string[], options: { cwd: string; encoding: 'utf8' }) => Promise<{ stdout: string }>;
const execFileAsync = promisify(execFile) as unknown as GitCommandRunner;

export class SimpleGitAdapter {
  private readonly runGit: GitCommandRunner;

  constructor(runGit: GitCommandRunner = execFileAsync) {
    this.runGit = runGit;
  }

  async getBranch(workspacePath: string): Promise<string | null> {
    try {
      const { stdout } = await this.runGit('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workspacePath, encoding: 'utf8' });
      return stdout.trim();
    } catch {
      return null;
    }
  }
}

export const gitAdapter = new SimpleGitAdapter();
