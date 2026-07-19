export type TerminalSession = {
  terminalId: string;
  shellId: string;
  shell: string;
  shellLabel: string;
  cwd: string;
};

export type CommandShell = {
  id: string;
  label: string;
  command: string;
};
