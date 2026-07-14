import { ipcMain } from 'electron';
import { terminalManager } from '../infrastructure/PtyTerminalManager.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';
import { randomUUID } from 'node:crypto';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function registerTerminalIpc() {
  ipcMain.handle('terminal:list-shells', async () => {
    return terminalManager.getAvailableCommandShells();
  });

  ipcMain.handle('terminal:create', async (event, rawPayload: unknown) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const terminalId = randomUUID();
    const workspaceRoot = await workspaceManager.getWorkspaceRoot();
    const shell = await terminalManager.resolveCommandShell(getString(payload.shellId));
    const cols = terminalManager.normalizeTerminalDimension(payload.cols, 100, 20, 400);
    const rows = terminalManager.normalizeTerminalDimension(payload.rows, 30, 5, 120);
    
    terminalManager.createTerminalProcess(
      terminalId,
      shell.command,
      workspaceRoot,
      cols,
      rows,
      (data) => {
        event.sender.send('terminal:data', { terminalId, data });
      },
      (exitCode, signal) => {
        terminalManager.removeTerminal(terminalId);
        event.sender.send('terminal:exit', { terminalId, exitCode, signal });
      },
    );

    return {
      terminalId,
      shellId: shell.id,
      shell: shell.command,
      shellLabel: shell.label,
      cwd: workspaceRoot,
    };
  });

  ipcMain.on('terminal:write', (_event, rawPayload: unknown) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const terminalId = getString(payload.terminalId);
    const data = getString(payload.data);
    terminalManager.getTerminal(terminalId)?.write(data);
  });

  ipcMain.on('terminal:resize', (_event, rawPayload: unknown) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const terminalId = getString(payload.terminalId);
    const terminal = terminalManager.getTerminal(terminalId);
    if (!terminal) return;

    terminal.resize(
      terminalManager.normalizeTerminalDimension(payload.cols, terminal.cols, 20, 400),
      terminalManager.normalizeTerminalDimension(payload.rows, terminal.rows, 5, 120),
    );
  });

  ipcMain.on('terminal:kill', (_event, rawPayload: unknown) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const terminalId = getString(payload.terminalId);
    terminalManager.getTerminal(terminalId)?.kill();
    terminalManager.removeTerminal(terminalId);
  });
}
