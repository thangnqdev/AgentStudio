export function summarizeToolArguments(toolName: string, args: Record<string, unknown>) {
  if (toolName === 'write_file') {
    const path = typeof args.path === 'string' ? args.path : '';
    const content = typeof args.content === 'string' ? args.content : '';
    return `path=${path} (${Buffer.byteLength(content, 'utf8')} bytes)`;
  }
  if (toolName === 'apply_patch') {
    const path = typeof args.path === 'string' ? args.path : '';
    const oldText = typeof args.oldText === 'string' ? args.oldText : '';
    const newText = typeof args.newText === 'string' ? args.newText : '';
    return `path=${path} (replace ${Buffer.byteLength(oldText, 'utf8')} bytes with ${Buffer.byteLength(newText, 'utf8')} bytes)`;
  }
  if (toolName === 'run_command') {
    const command = typeof args.command === 'string' ? args.command.trim() : '';
    return command.length > 320 ? `${command.slice(0, 320)}...` : command;
  }
  if (toolName === 'read_file') return `path=${typeof args.path === 'string' ? args.path : ''}`;
  if (toolName === 'list_files') return `dir=${typeof args.dir === 'string' ? args.dir : '.'}`;
  if (toolName === 'web_search') {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    const domains = typeof args.domains === 'string' ? args.domains.trim() : '';
    return domains ? `query=${query} | domains=${domains}` : `query=${query}`;
  }
  if (toolName === 'load_skill') return `skillId=${typeof args.skillId === 'string' ? args.skillId : ''}`;
  if (toolName === 'delegate_task') {
    const role = typeof args.role === 'string' ? args.role : 'explore';
    const characters = typeof args.prompt === 'string' ? args.prompt.length : 0;
    return `role=${role} (${characters} prompt characters)`;
  }
  return Object.keys(args).sort().join(', ');
}
