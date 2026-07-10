import { describe, expect, it } from 'vitest';
import { ElectronToolApprovalManager } from './ElectronToolApprovalManager.js';

describe('ElectronToolApprovalManager', () => {
  it('resolves a pending tool approval from the renderer response', async () => {
    const manager = new ElectronToolApprovalManager();
    const decision = manager.requestApproval({ actionId: 'action-1', requestId: 'request-1', risk: 'write', toolName: 'write_file', summary: 'path=note.md', workspaceRoot: '/workspace' });

    manager.respond('request-1', 'action-1', true);

    await expect(decision).resolves.toBe(true);
  });

  it('denies pending approvals when a request is cancelled', async () => {
    const manager = new ElectronToolApprovalManager();
    const decision = manager.requestApproval({ actionId: 'action-1', requestId: 'request-1', risk: 'execute', toolName: 'run_command', summary: 'npm test', workspaceRoot: '/workspace' });

    manager.cancelRequest('request-1');

    await expect(decision).resolves.toBe(false);
  });
});
