import type { ToolApprovalRequest } from '../entities/tool.js';

export interface IToolApprovalGateway {
  requestApproval(request: ToolApprovalRequest): Promise<boolean>;
}
