function bridge() { if (!window.agentStudio) throw new Error('Electron bridge is not available.'); return window.agentStudio; }
export const WorkflowBridge = {
  definitions: () => bridge().listWorkflowDefinitions(), runs: (limit = 50) => bridge().listWorkflowRuns(limit),
  start: (workflowId: string) => bridge().startWorkflow(workflowId),
  resume: (payload: Parameters<NonNullable<Window['agentStudio']>['resumeWorkflow']>[0]) => bridge().resumeWorkflow(payload),
};
