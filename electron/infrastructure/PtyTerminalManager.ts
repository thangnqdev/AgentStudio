import { spawn as spawnChild } from 'node:child_process';
import { spawn as spawnPty } from 'node-pty';
import path from 'node:path';
import fs from 'node:fs/promises';
import { normalizePipeTerminalInput } from '../application/services/normalizeTerminalInput.js';

export type TerminalProcess = {
  cols: number;
  rows: number;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
};

export type CommandShell = {
  id: string;
  label: string;
  command: string;
};

export class PtyTerminalManager {
  private activeTerminals = new Map<string, TerminalProcess>();

  buildTerminalEnv() {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') {
        env[key] = value;
      }
    }

    env.TERM = 'xterm-256color';
    env.COLORTERM = 'truecolor';
    return env;
  }

  getWindowsShellCandidates(): CommandShell[] {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const comSpec = process.env.ComSpec || path.join(systemRoot, 'System32', 'cmd.exe');

    return [
      { id: 'powershell', label: 'Windows PowerShell', command: path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') },
      { id: 'pwsh', label: 'PowerShell 7+', command: path.join(programFiles, 'PowerShell', '7', 'pwsh.exe') },
      { id: 'pwsh-path', label: 'PowerShell từ PATH', command: 'pwsh.exe' },
      { id: 'cmd', label: 'Command Prompt', command: comSpec },
    ];
  }

  getUnixShellCandidates(): CommandShell[] {
    const defaultShell = process.env.SHELL;
    const candidates: CommandShell[] = [];

    if (defaultShell) {
      candidates.push({ id: 'default', label: `${path.basename(defaultShell)} mặc định`, command: defaultShell });
    }

    candidates.push(
      { id: 'zsh', label: 'zsh', command: '/bin/zsh' },
      { id: 'bash', label: 'bash', command: '/bin/bash' },
      { id: 'sh', label: 'sh', command: '/bin/sh' },
      { id: 'fish', label: 'fish', command: '/opt/homebrew/bin/fish' },
      { id: 'fish-usr', label: 'fish', command: '/usr/local/bin/fish' },
    );

    return candidates;
  }

  async fileExists(filePath: string) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async shellCommandExists(command: string) {
    if (path.isAbsolute(command)) {
      return this.fileExists(command);
    }

    const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    for (const entry of pathEntries) {
      if (await this.fileExists(path.join(entry, command))) {
        return true;
      }
    }

    return false;
  }

  async getAvailableCommandShells(): Promise<CommandShell[]> {
    const candidates = process.platform === 'win32'
      ? this.getWindowsShellCandidates()
      : this.getUnixShellCandidates();
    const shells: CommandShell[] = [];
    const seenCommands = new Set<string>();

    for (const candidate of candidates) {
      if (seenCommands.has(candidate.command.toLowerCase())) continue;
      if (!await this.shellCommandExists(candidate.command)) continue;

      seenCommands.add(candidate.command.toLowerCase());
      shells.push(candidate);
    }

    if (shells.length > 0) return shells;

    const fallback = process.platform === 'win32'
      ? { id: 'cmd', label: 'Command Prompt', command: process.env.ComSpec || 'cmd.exe' }
      : { id: 'sh', label: 'sh', command: '/bin/sh' };
    return [fallback];
  }

  async resolveCommandShell(shellId: string) {
    const shells = await this.getAvailableCommandShells();
    return shells.find((shell) => shell.id === shellId) ?? shells[0];
  }

  normalizeTerminalDimension(value: unknown, fallback: number, min: number, max: number) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return fallback;
    return Math.min(Math.max(Math.floor(numericValue), min), max);
  }

  killAllTerminals() {
    for (const terminal of this.activeTerminals.values()) {
      terminal.kill();
    }
    this.activeTerminals.clear();
  }

  createTerminalProcess(
    terminalId: string,
    shell: string,
    cwd: string,
    cols: number,
    rows: number,
    onData: (data: string) => void,
    onExit: (exitCode: number | undefined, signal: number | string | undefined) => void,
  ): TerminalProcess {
    let terminalProcess: TerminalProcess;
    try {
      const terminal = spawnPty(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: this.buildTerminalEnv(),
      });

      terminal.onData(onData);
      terminal.onExit(({ exitCode, signal }) => onExit(exitCode, signal));

      terminalProcess = {
        get cols() {
          return terminal.cols;
        },
        get rows() {
          return terminal.rows;
        },
        write: (data) => terminal.write(data),
        resize: (nextCols, nextRows) => terminal.resize(nextCols, nextRows),
        kill: () => terminal.kill(),
      };
    } catch (error) {
      const fallbackArgs = process.platform === 'win32' ? [] : ['-s'];
      const child = spawnChild(shell, fallbackArgs, {
        cwd,
        env: this.buildTerminalEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let currentCols = cols;
      let currentRows = rows;

      onData(`\r\n[terminal] Đang chạy ở chế độ tương thích: ${error instanceof Error ? error.message : String(error)}\r\n`);
      child.stdout?.on('data', (data: Buffer) => onData(data.toString('utf8')));
      child.stderr?.on('data', (data: Buffer) => onData(data.toString('utf8')));
      child.on('exit', (exitCode, signal) => onExit(exitCode ?? undefined, signal ?? undefined));

      terminalProcess = {
        get cols() {
          return currentCols;
        },
        get rows() {
          return currentRows;
        },
        write: (data) => {
          onData(data.replaceAll('\r', '\r\n'));
          child.stdin?.write(normalizePipeTerminalInput(data));
        },
        resize: (nextCols, nextRows) => {
          currentCols = nextCols;
          currentRows = nextRows;
        },
        kill: () => {
          // Remove all listeners first to prevent data events firing during/after kill
          child.stdout?.removeAllListeners();
          child.stderr?.removeAllListeners();
          child.removeAllListeners();
          // Close stdin to signal EOF to the shell
          child.stdin?.end();
          child.kill('SIGTERM');
        },
      };
    }

    this.activeTerminals.set(terminalId, terminalProcess);
    return terminalProcess;
  }

  getTerminal(terminalId: string) {
    return this.activeTerminals.get(terminalId);
  }

  removeTerminal(terminalId: string) {
    this.activeTerminals.delete(terminalId);
  }
}

export const terminalManager = new PtyTerminalManager();
