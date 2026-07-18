import type { PermissionMode, ToolResult } from '../../domain/entities/agent.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';

type Alias = { name: string; target: string; parameters: AgentToolDefinition['parameters'] };
const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object', additionalProperties: false, properties, ...(required.length ? { required } : {}),
});
const pathField = { type: 'string', description: 'File or directory path.' };
const ALIASES: Alias[] = [
  { name: 'Read', target: 'read_file', parameters: object({ file_path: pathField, offset: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 10_000 }, pages: { type: 'string' } }, ['file_path']) },
  { name: 'Write', target: 'write_file', parameters: object({ file_path: pathField, content: { type: 'string' } }, ['file_path', 'content']) },
  { name: 'Edit', target: 'apply_patch', parameters: object({ file_path: pathField, old_string: { type: 'string' }, new_string: { type: 'string' }, replace_all: { type: 'boolean' } }, ['file_path', 'old_string', 'new_string']) },
  { name: 'Glob', target: 'glob', parameters: object({ pattern: { type: 'string' }, path: pathField }, ['pattern']) },
  { name: 'Grep', target: 'grep', parameters: object({ pattern: { type: 'string' }, path: pathField, glob: { type: 'string' }, output_mode: { type: 'string', enum: ['content', 'files_with_matches', 'count'] }, '-B': { type: 'integer', minimum: 0, maximum: 100 }, '-A': { type: 'integer', minimum: 0, maximum: 100 }, '-C': { type: 'integer', minimum: 0, maximum: 100 }, context: { type: 'integer', minimum: 0, maximum: 100 }, '-n': { type: 'boolean' }, '-i': { type: 'boolean' }, type: { type: 'string' }, head_limit: { type: 'integer', minimum: 0, maximum: 500 }, offset: { type: 'integer', minimum: 0, maximum: 10_000 }, multiline: { type: 'boolean' } }, ['pattern']) },
  { name: 'Bash', target: 'run_command', parameters: object({ command: { type: 'string' }, timeout: { type: 'integer', minimum: 1_000, maximum: 600_000 }, description: { type: 'string' }, run_in_background: { type: 'boolean' } }, ['command']) },
  { name: 'PowerShell', target: 'run_command', parameters: object({ command: { type: 'string' }, timeout: { type: 'integer', minimum: 1_000, maximum: 600_000 }, description: { type: 'string' }, run_in_background: { type: 'boolean' } }, ['command']) },
  { name: 'WebSearch', target: 'web_search', parameters: object({ query: { type: 'string', minLength: 2, maxLength: 1_000 }, allowed_domains: { type: 'array', items: { type: 'string' }, maxItems: 20 }, blocked_domains: { type: 'array', items: { type: 'string' }, maxItems: 20 } }, ['query']) },
  { name: 'Skill', target: 'load_skill', parameters: object({ skill: { type: 'string' }, args: { type: 'string', maxLength: 20_000 } }, ['skill']) },
];

export class CompatibilityToolPlatform implements IToolCatalog, IToolExecutor {
  private readonly baseCatalog: IToolCatalog;
  private readonly baseExecutor: IToolExecutor;

  constructor(baseCatalog: IToolCatalog, baseExecutor: IToolExecutor) {
    this.baseCatalog = baseCatalog; this.baseExecutor = baseExecutor;
  }

  async list(workspaceRoot: string) {
    const tools = await this.baseCatalog.list(workspaceRoot);
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    const aliases = ALIASES.flatMap((alias) => {
      if (byName.has(alias.name)) return [];
      const target = byName.get(alias.target);
      if (!target) return [];
      return [{
        ...structuredClone(target), name: alias.name, parameters: structuredClone(alias.parameters),
        deferLoading: true, searchHint: `${target.searchHint ?? target.description} compatibility ${alias.name}`,
        description: `${target.description} Exact compatibility name for ${alias.target}.`,
      }];
    });
    const names = new Set(aliases.map((alias) => alias.name));
    return [...tools.filter((tool) => !names.has(tool.name)), ...aliases];
  }

  async execute(toolName: string, args: Record<string, unknown>, workspaceRoot: string, permissionMode: PermissionMode, signal?: AbortSignal): Promise<ToolResult> {
    const alias = ALIASES.find((candidate) => candidate.name === toolName);
    if (!alias) return this.baseExecutor.execute(toolName, args, workspaceRoot, permissionMode, signal);
    if (toolName === 'Grep' && args.type !== undefined && !typeGlob(args.type)) {
      return { ok: false, output: `Unsupported Grep file type: ${String(args.type)}.` };
    }
    if (toolName === 'WebSearch' && strings(args.allowed_domains).length && strings(args.blocked_domains).length) {
      return { ok: false, output: 'Cannot specify both allowed_domains and blocked_domains in the same request.' };
    }
    if (toolName === 'WebSearch' && (typeof args.query !== 'string' || args.query.trim().length < 2)) {
      return { ok: false, output: 'WebSearch query must contain at least two characters.' };
    }
    const result = await this.baseExecutor.execute(alias.target, transformArguments(toolName, args), workspaceRoot, permissionMode, signal);
    return toolName === 'Read' && result.ok && !result.supplementalMessages?.length && !String(args.file_path).toLowerCase().endsWith('.ipynb')
      ? { ...result, output: addLineNumbers(result.output, typeof args.offset === 'number' ? args.offset : 1) }
      : result;
  }
}

function transformArguments(toolName: string, args: Record<string, unknown>) {
  if (toolName === 'Read') return { path: args.file_path, offset: args.offset === 0 ? 1 : args.offset, limit: args.limit, pages: args.pages };
  if (toolName === 'Write') return { path: args.file_path, content: args.content };
  if (toolName === 'Edit') return { path: args.file_path, oldText: args.old_string, newText: args.new_string, replaceAll: args.replace_all };
  if (toolName === 'Grep') {
    const context = args.context ?? args['-C'];
    return {
      pattern: args.pattern, path: args.path, glob: args.glob, typeGlob: typeGlob(args.type), regex: true,
      caseSensitive: args['-i'] !== true, outputMode: args.output_mode ?? 'files_with_matches',
      contextBefore: args['-B'] ?? context, contextAfter: args['-A'] ?? context,
      lineNumbers: args['-n'] ?? true, maxResults: args.head_limit ?? 250, offset: args.offset,
      multiline: args.multiline === true,
    };
  }
  if (toolName === 'Bash' || toolName === 'PowerShell') return {
    command: args.command, timeoutMs: args.timeout, description: args.description,
    run_in_background: args.run_in_background, ...(toolName === 'PowerShell' ? { shell: 'powershell' } : {}),
  };
  if (toolName === 'Skill') return { skillId: args.skill, args: args.args };
  if (toolName === 'WebSearch') {
    const allowed = strings(args.allowed_domains); const blocked = strings(args.blocked_domains);
    const query = `${String(args.query ?? '')}${blocked.map((domain) => ` -site:${domain}`).join('')}`;
    return { query, ...(allowed.length ? { domains: allowed.join(',') } : {}) };
  }
  return args;
}

function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 20) : []; }
function addLineNumbers(content: string, startLine: number) {
  if (!content) return '';
  return content.split(/\r?\n/).map((line, index) => `${String(startLine + index).padStart(6, ' ')}→${line}`).join('\n');
}
function typeGlob(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const extension = ({ js: '*.{js,jsx,mjs,cjs}', ts: '*.{ts,tsx,mts,cts}', py: '*.py', rust: '*.rs', go: '*.go', java: '*.java' } as Record<string, string>)[value];
  return extension ? `**/${extension}` : undefined;
}
