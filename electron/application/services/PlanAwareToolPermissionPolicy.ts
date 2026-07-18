import type { IToolPermissionPolicy } from '../../domain/ports/IToolPermissionPolicy.js';
import type { ManageAgentPlanMode } from '../usecases/ManageAgentPlanMode.js';
import { AGENT_CONFIG_TOOL_NAME } from '../../domain/entities/agentConfig.js';
import { INTERACTIVE_TOOL_NAMES } from './interactiveToolDefinitions.js';

const PLAN_SAFE_NETWORK_TOOLS = new Set(['web_search']);

export class PlanAwareToolPermissionPolicy implements IToolPermissionPolicy {
  private readonly base: IToolPermissionPolicy;
  private readonly plans: ManageAgentPlanMode;
  private readonly scopeId: string;

  constructor(base: IToolPermissionPolicy, plans: ManageAgentPlanMode, scopeId: string) {
    this.base = base;
    this.plans = plans;
    this.scopeId = scopeId;
  }

  async evaluate(input: Parameters<IToolPermissionPolicy['evaluate']>[0]) {
    const interactive = (INTERACTIVE_TOOL_NAMES as readonly string[]).includes(input.tool.name);
    const configRead = input.tool.name === AGENT_CONFIG_TOOL_NAME && !Object.hasOwn(input.args, 'value');
    const safeDuringPlan = input.tool.risk === 'read' || input.tool.readOnly || PLAN_SAFE_NETWORK_TOOLS.has(input.tool.name) || interactive || configRead;
    if (this.plans.isActive(this.scopeId) && !safeDuringPlan) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `${input.tool.name} is blocked while plan mode is active. Explore with read-only tools, then call ExitPlanMode with the completed plan.`,
      };
    }
    return this.base.evaluate(input);
  }
}
