import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import { AGENT_CONFIG_TOOL_DEFINITION, AGENT_CONFIG_TOOL_NAME } from '../../domain/entities/agentConfig.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { AgentConfigMutationResult, ManageAgentConfig } from '../usecases/ManageAgentConfig.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';

type ConfigChangeListener = (change: AgentConfigMutationResult) => void;

export class ConfigToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;
  private readonly config: ManageAgentConfig;
  private readonly onChanged?: ConfigChangeListener;
  private readonly hooks?: ILifecycleHookDispatcher;

  constructor(
    baseCatalog: IToolCatalog,
    baseExecutor: IToolExecutor,
    config: ManageAgentConfig,
    onChanged?: ConfigChangeListener,
    hooks?: ILifecycleHookDispatcher,
  ) {
    this.baseCatalog = baseCatalog;
    this.baseExecutor = baseExecutor;
    this.config = config;
    this.onChanged = onChanged;
    this.hooks = hooks;
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(workspaceRoot);
    return [...tools.filter((tool) => tool.name !== AGENT_CONFIG_TOOL_NAME), structuredClone(AGENT_CONFIG_TOOL_DEFINITION)];
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    if (toolName !== AGENT_CONFIG_TOOL_NAME) {
      return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    }
    try {
      if (!Object.hasOwn(args, 'value')) {
        const result = await this.config.read(args.setting);
        return { ok: true, output: JSON.stringify({ success: true, operation: 'get', ...result }) };
      }
      const result = await this.config.write(args.setting, args.value);
      try { this.onChanged?.(result); } catch { /* Persistence succeeded; renderer sync is best effort. */ }
      await this.hooks?.dispatch({
        event: 'ConfigChange', workspaceRoot, matchValue: result.setting, toolName: AGENT_CONFIG_TOOL_NAME,
      }).catch(() => undefined);
      return {
        ok: true,
        output: JSON.stringify({
          success: true,
          operation: 'set',
          setting: result.setting,
          previousValue: result.previousValue,
          newValue: result.newValue,
        }),
      };
    } catch (error) {
      return { ok: false, output: error instanceof Error ? error.message : 'Config operation failed.' };
    }
  }
}
