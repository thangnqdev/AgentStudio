export function summarizeToolArguments(toolName: string, args: Record<string, unknown>) {
  if (toolName === 'write_file') {
    const path = typeof args.path === 'string' ? args.path : '';
    const content = typeof args.content === 'string' ? args.content : '';
    return `path=${path} (${Buffer.byteLength(content, 'utf8')} bytes)`;
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
  return Object.keys(args).sort().join(', ');
}
