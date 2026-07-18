import type { IToolApprovalGateway } from '../../domain/ports/IToolApprovalGateway.js';
import type { ToolApprovalRequest } from '../../domain/entities/tool.js';
import type { IUserPermissionRuleWriter } from '../../domain/ports/IUserPermissionRuleWriter.js';

const APPROVAL_TIMEOUT_MS = 120_000;

type PendingApproval = {
  resolve(approved: boolean): void;
  timeout: NodeJS.Timeout;
  request: ToolApprovalRequest;
};

export class ElectronToolApprovalManager implements IToolApprovalGateway {
  private readonly pendingApprovals = new Map<string, PendingApproval>();
  private readonly ruleWriter?: IUserPermissionRuleWriter;

  constructor(ruleWriter?: IUserPermissionRuleWriter) { this.ruleWriter = ruleWriter; }

  requestApproval(request: ToolApprovalRequest) {
    const key = this.key(request.requestId, request.actionId);
    this.resolve(key, false);
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => this.resolve(key, false), APPROVAL_TIMEOUT_MS);
      this.pendingApprovals.set(key, { resolve, timeout, request });
    });
  }

  respond(requestId: string, actionId: string, approved: boolean, rememberDomain = false) {
    const key = this.key(requestId, actionId);
    const pending = this.pendingApprovals.get(key);
    if (!approved || !rememberDomain || !pending?.request.domain || !this.ruleWriter) {
      this.resolve(key, approved);
      return;
    }
    void this.ruleWriter.allowDomain({ ...pending.request, domain: pending.request.domain })
      .then(() => this.resolve(key, true))
      .catch(() => this.resolve(key, true));
  }

  cancelRequest(requestId: string) {
    for (const key of this.pendingApprovals.keys()) {
      if (key.startsWith(`${requestId}:`)) this.resolve(key, false);
    }
  }

  private key(requestId: string, actionId: string) {
    return `${requestId}:${actionId}`;
  }

  private resolve(key: string, approved: boolean) {
    const pending = this.pendingApprovals.get(key);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pendingApprovals.delete(key);
    pending.resolve(approved);
  }
}
