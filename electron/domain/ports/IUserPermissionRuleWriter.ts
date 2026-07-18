import type { ToolApprovalRequest } from '../entities/tool.js';

export interface IUserPermissionRuleWriter {
  allowDomain(request: ToolApprovalRequest & { domain: string }): Promise<void>;
}
