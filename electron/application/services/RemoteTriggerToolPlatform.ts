import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import { REMOTE_TRIGGER_TOOL_DEFINITION, REMOTE_TRIGGER_TOOL_NAME } from '../../domain/entities/remoteTrigger.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { ExecuteRemoteTrigger } from '../usecases/ExecuteRemoteTrigger.js';
import type { ManageRemoteTriggerSettings } from '../usecases/ManageRemoteTriggerSettings.js';

export class RemoteTriggerToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly executeRemote: ExecuteRemoteTrigger;
  private readonly settings: ManageRemoteTriggerSettings;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    executeRemote: ExecuteRemoteTrigger,
    settings: ManageRemoteTriggerSettings,
  ) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.executeRemote = executeRemote;
    this.settings = settings;
  }

  async list(workspaceRoot: string) {
    const tools = (await this.baseCatalog.list(workspaceRoot)).filter((tool) => tool.name !== REMOTE_TRIGGER_TOOL_NAME);
    try {
      const configured = await this.settings.load();
      return configured.enabled ? [...tools, structuredClone(REMOTE_TRIGGER_TOOL_DEFINITION)] : tools;
    } catch {
      return tools;
    }
  }

  async execute(toolName: string, args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode, signal?: AbortSignal): Promise<ToolResult> {
    if (toolName !== REMOTE_TRIGGER_TOOL_NAME) {
      return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    }
    try {
      const output = await this.executeRemote.execute(args, signal);
      return { ok: true, output: JSON.stringify(output) };
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'RemoteTrigger failed.' };
    }
  }
}
