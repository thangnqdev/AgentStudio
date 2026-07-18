const TOOL_ALIASES: Readonly<Record<string, string>> = {
  Read: 'read_file', Write: 'write_file', Edit: 'apply_patch', Glob: 'glob', Grep: 'grep',
  Bash: 'run_command', PowerShell: 'run_command', WebSearch: 'web_search', Skill: 'load_skill',
  AgentOutputTool: 'TaskOutput', BashOutputTool: 'TaskOutput', task_output: 'TaskOutput',
  KillShell: 'TaskStop', task_stop: 'TaskStop',
};

export function canonicalToolName(name: string) { return TOOL_ALIASES[name] ?? name; }
