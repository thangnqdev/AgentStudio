import type { SubagentRequest, SubagentRunResult } from '../entities/subagent.js';

export interface ISubagentRunner {
  run(input: SubagentRequest & { workspaceRoot: string }): Promise<SubagentRunResult>;
}
