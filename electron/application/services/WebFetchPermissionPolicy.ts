import { WEB_FETCH_TOOL_NAME } from '../../domain/entities/webFetch.js';
import { isPreapprovedWebFetchUrl } from '../../domain/entities/webFetchPreapproved.js';
import type { IToolPermissionPolicy } from '../../domain/ports/IToolPermissionPolicy.js';

export class WebFetchPermissionPolicy implements IToolPermissionPolicy {
  private readonly base: IToolPermissionPolicy;

  constructor(base: IToolPermissionPolicy) {
    this.base = base;
  }

  async evaluate(input: Parameters<IToolPermissionPolicy['evaluate']>[0]) {
    const decision = await this.base.evaluate(input);
    if (input.tool.name !== WEB_FETCH_TOOL_NAME || decision.matchedRule || !decision.allowed) return decision;
    const url = typeof input.args.url === 'string' ? input.args.url : '';
    return isPreapprovedWebFetchUrl(url) ? { ...decision, requiresApproval: false } : decision;
  }
}
