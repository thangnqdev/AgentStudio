import { canonicalToolName } from '../../domain/entities/toolAliases.js';

export function summarizeToolArguments(toolName: string, args: Record<string, unknown>) {
  const canonicalName = canonicalToolName(toolName);
  if (canonicalName === 'write_file') {
    const path = typeof (args.path ?? args.file_path) === 'string' ? String(args.path ?? args.file_path) : '';
    const content = typeof args.content === 'string' ? args.content : '';
    return `path=${path} (${Buffer.byteLength(content, 'utf8')} bytes)`;
  }
  if (canonicalName === 'apply_patch') {
    const path = typeof (args.path ?? args.file_path) === 'string' ? String(args.path ?? args.file_path) : '';
    const oldText = typeof (args.oldText ?? args.old_string) === 'string' ? String(args.oldText ?? args.old_string) : '';
    const newText = typeof (args.newText ?? args.new_string) === 'string' ? String(args.newText ?? args.new_string) : '';
    return `path=${path} (replace ${Buffer.byteLength(oldText, 'utf8')} bytes with ${Buffer.byteLength(newText, 'utf8')} bytes)`;
  }
  if (canonicalName === 'run_command') {
    const command = typeof args.command === 'string' ? args.command.trim() : '';
    return command.length > 320 ? `${command.slice(0, 320)}...` : command;
  }
  if (canonicalName === 'read_file') return `path=${typeof (args.path ?? args.file_path) === 'string' ? String(args.path ?? args.file_path) : ''}`;
  if (toolName === 'list_files') return `dir=${typeof args.dir === 'string' ? args.dir : '.'}`;
  if (canonicalName === 'glob') return `pattern=${typeof args.pattern === 'string' ? args.pattern : ''}`;
  if (canonicalName === 'grep') return `pattern=${typeof args.pattern === 'string' ? args.pattern : ''}`;
  if (canonicalName === 'web_search') {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    const exactDomains = [...toStrings(args.allowed_domains), ...toStrings(args.blocked_domains).map((domain) => `!${domain}`)].join(',');
    const domains = typeof args.domains === 'string' ? args.domains.trim() : exactDomains;
    return domains ? `query=${query} | domains=${domains}` : `query=${query}`;
  }
  if (toolName === 'WebFetch') {
    try {
      const hostname = typeof args.url === 'string' ? new URL(args.url).hostname : 'invalid URL';
      const characters = typeof args.prompt === 'string' ? args.prompt.length : 0;
      return `host=${hostname} (${characters} prompt characters)`;
    } catch {
      return 'host=invalid URL';
    }
  }
  if (toolName === 'NotebookEdit') {
    const notebookPath = typeof args.notebook_path === 'string' ? args.notebook_path : '';
    const cellId = typeof args.cell_id === 'string' ? args.cell_id : 'new cell';
    const editMode = typeof args.edit_mode === 'string' ? args.edit_mode : 'replace';
    return `notebook=${notebookPath} cell=${cellId} mode=${editMode}`;
  }
  if (toolName === 'LSP') {
    const operation = typeof args.operation === 'string' ? args.operation : '';
    const filePath = typeof args.filePath === 'string' ? args.filePath : '';
    return `operation=${operation} file=${filePath} line=${typeof args.line === 'number' ? args.line : ''} character=${typeof args.character === 'number' ? args.character : ''}`;
  }
  if (canonicalName === 'load_skill') return `skillId=${typeof (args.skillId ?? args.skill) === 'string' ? String(args.skillId ?? args.skill) : ''}`;
  if (toolName === 'delegate_task') {
    const role = typeof args.role === 'string' ? args.role : 'explore';
    const agentId = typeof args.agentId === 'string' ? ` agentId=${args.agentId}` : '';
    const characters = typeof args.prompt === 'string' ? args.prompt.length : 0;
    return `role=${role}${agentId} (${characters} prompt characters)`;
  }
  if (toolName === 'Agent') {
    const name = typeof args.name === 'string' ? ` name=${args.name}` : '';
    const description = typeof args.description === 'string' ? args.description.slice(0, 120) : '';
    const characters = typeof args.prompt === 'string' ? args.prompt.length : 0;
    return `description=${description}${name} background=${args.run_in_background === true} (${characters} prompt characters)`;
  }
  if (toolName === 'SendMessage') {
    const recipient = typeof args.to === 'string' ? args.to : '';
    const message = args.message;
    const detail = typeof message === 'string' ? `${message.length} message characters` : `type=${typeof message === 'object' && message && 'type' in message ? String(message.type) : 'invalid'}`;
    return `to=${recipient} (${detail})`;
  }
  if (toolName === 'AskUserQuestion') {
    return `questions=${Array.isArray(args.questions) ? args.questions.length : 0}`;
  }
  if (toolName === 'EnterPlanMode') return 'request plan mode';
  if (toolName === 'ExitPlanMode') {
    return `plan=${typeof args.plan === 'string' ? args.plan.length : 0} characters`;
  }
  if (toolName === 'EnterWorktree') {
    return `name=${typeof args.name === 'string' ? args.name : 'auto-generated'}`;
  }
  if (toolName === 'ExitWorktree') {
    const action = args.action === 'remove' || args.action === 'keep' ? args.action : 'invalid';
    return `action=${action} discard_changes=${args.discard_changes === true}`;
  }
  return Object.keys(args).sort().join(', ');
}

function toStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 20) : [];
}
