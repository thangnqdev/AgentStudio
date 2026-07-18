export type AgentWorkerProcessBootstrap = {
  endpoint: string;
  teamId: string;
  workerId: string;
  instanceId: string;
  epoch: number;
  secret: string;
  outbound?: { messageId: string; recipient: string; payload: string };
};

export interface IAgentWorkerProcessHost {
  run(input: { cwd: string; bootstrap: AgentWorkerProcessBootstrap }, signal?: AbortSignal): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>;
}
