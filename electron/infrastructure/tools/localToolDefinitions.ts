import type { AgentToolDefinition } from '../../domain/entities/tool.js';

export const LOCAL_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  { name: 'list_files', description: 'List files and folders inside the current workspace.', risk: 'read', concurrencySafe: true, parameters: { properties: { dir: { type: 'string', description: 'Workspace-relative directory. Defaults to current workspace root.' }, maxEntries: { type: 'number', description: 'Maximum entries to return.' } } } },
  { name: 'read_file', description: 'Read a UTF-8 text file from the workspace.', risk: 'read', concurrencySafe: true, parameters: { properties: { path: { type: 'string', description: 'Workspace-relative file path.' } }, required: ['path'] } },
  { name: 'write_file', description: 'Write complete UTF-8 content to a workspace file.', risk: 'write', parameters: { properties: { path: { type: 'string', description: 'Workspace-relative file path.' }, content: { type: 'string', description: 'Full file content.' } }, required: ['path', 'content'] } },
  { name: 'apply_patch', description: 'Replace one exact text block in an existing UTF-8 file without resending the entire file.', risk: 'write', parameters: { properties: { path: { type: 'string', description: 'Workspace-relative file path.' }, oldText: { type: 'string', description: 'Exact existing text to replace. It must occur exactly once.' }, newText: { type: 'string', description: 'Replacement text.' } }, required: ['path', 'oldText', 'newText'] } },
  { name: 'run_command', description: 'Run a shell command in the workspace.', risk: 'execute', parameters: { properties: { command: { type: 'string', description: 'Shell command to run.' }, timeoutMs: { type: 'number', description: 'Timeout in milliseconds, max 30000.' } }, required: ['command'] } },
  { name: 'web_search', description: 'Search the public web through the configured connector.', risk: 'network', parameters: { properties: { query: { type: 'string', description: 'Focused web search query.' }, domains: { type: 'string', description: 'Optional comma-separated domains.' } }, required: ['query'] } },
  { name: 'load_skill', description: 'Load the full instructions for a user-trusted and enabled Agent Skill by id.', risk: 'read', concurrencySafe: true, parameters: { properties: { skillId: { type: 'string', description: 'Skill id listed in the system prompt.' } }, required: ['skillId'] } },
];

export function getLocalToolDefinition(toolName: string) {
  return LOCAL_TOOL_DEFINITIONS.find((tool) => tool.name === toolName);
}
