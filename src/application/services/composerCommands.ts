export type ComposerCommandAction =
  | { kind: 'navigate'; view: 'tasks' | 'knowledge' | 'observability' | 'capabilities' | 'agents' | 'settings'; anchorId?: string }
  | { kind: 'open-picker'; picker: 'model' | 'permission' | 'resume' | 'rename' | 'context' | 'status' | 'hooks' | 'compact' }
  | { kind: 'clear-thread' }
  | { kind: 'new-thread' }
  | { kind: 'insert'; value: string };

export interface ComposerCommand {
  name: string;
  aliases?: string[];
  description: string;
  icon: string;
  keywords?: string[];
  action: ComposerCommandAction;
}

const COMMANDS: ComposerCommand[] = [
  { name: 'config', aliases: ['settings'], description: 'Mở cấu hình AgentStudio', icon: 'settings', action: { kind: 'navigate', view: 'settings' } },
  { name: 'agents', description: 'Quản lý cấu hình agent', icon: 'smart_toy', action: { kind: 'navigate', view: 'agents' } },
  { name: 'mcp', description: 'Quản lý MCP servers', icon: 'hub', action: { kind: 'navigate', view: 'settings', anchorId: 'mcp-settings' } },
  { name: 'model', description: 'Chọn model đang hoạt động', icon: 'neurology', action: { kind: 'open-picker', picker: 'model' } },
  { name: 'permissions', description: 'Chọn chế độ quyền của agent', icon: 'shield', keywords: ['sandbox'], action: { kind: 'open-picker', picker: 'permission' } },
  { name: 'resume', aliases: ['continue'], description: 'Tiếp tục một agent task đã tạm dừng', icon: 'resume', action: { kind: 'open-picker', picker: 'resume' } },
  { name: 'rename', description: 'Đổi tên chat hiện tại', icon: 'drive_file_rename_outline', action: { kind: 'open-picker', picker: 'rename' } },
  { name: 'context', description: 'Xem mức sử dụng context hiện tại', icon: 'grid_view', keywords: ['tokens'], action: { kind: 'open-picker', picker: 'context' } },
  { name: 'status', description: 'Xem trạng thái phiên AgentStudio', icon: 'info', action: { kind: 'open-picker', picker: 'status' } },
  { name: 'hooks', description: 'Xem lifecycle hooks đang hiệu lực', icon: 'webhook', action: { kind: 'open-picker', picker: 'hooks' } },
  { name: 'compact', description: 'Nén lịch sử cũ thành summary cục bộ', icon: 'compress', action: { kind: 'open-picker', picker: 'compact' } },
  { name: 'tasks', description: 'Quay lại tác vụ và background agents', icon: 'task_alt', action: { kind: 'navigate', view: 'tasks' } },
  { name: 'knowledge', description: 'Mở cơ sở tri thức', icon: 'menu_book', action: { kind: 'navigate', view: 'knowledge' } },
  { name: 'traces', aliases: ['observability'], description: 'Mở trace và hoạt động agent', icon: 'monitoring', action: { kind: 'navigate', view: 'observability' } },
  { name: 'capabilities', description: 'Mở tools, skills và capabilities', icon: 'extension', action: { kind: 'navigate', view: 'capabilities' } },
  { name: 'clear', description: 'Xóa lịch sử của chat hiện tại', icon: 'delete_sweep', action: { kind: 'clear-thread' } },
  { name: 'new', description: 'Tạo chat mới', icon: 'add_comment', action: { kind: 'new-thread' } },
  {
    name: 'plan',
    description: 'Soạn yêu cầu chuyển agent vào Plan Mode',
    icon: 'edit_note',
    action: { kind: 'insert', value: 'Hãy dùng EnterPlanMode để khảo sát và lập kế hoạch chi tiết trước khi thay đổi code.' },
  },
];

export function findComposerCommands(input: string, limit = 7): ComposerCommand[] {
  const match = /^\/([^\s]*)$/.exec(input);
  if (!match) return [];
  const query = match[1].toLocaleLowerCase();
  return COMMANDS
    .map((command) => ({ command, score: scoreCommand(command, query) }))
    .filter((candidate) => candidate.score < 4)
    .sort((left, right) => left.score - right.score || left.command.name.localeCompare(right.command.name))
    .slice(0, limit)
    .map((candidate) => candidate.command);
}

function scoreCommand(command: ComposerCommand, query: string): number {
  if (!query) return 3;
  const names = [command.name, ...(command.aliases ?? [])];
  if (names.includes(query)) return 0;
  if (names.some((name) => name.startsWith(query))) return 1;
  const searchable = [...names, ...(command.keywords ?? []), command.description.toLocaleLowerCase()];
  return searchable.some((value) => value.includes(query)) ? 2 : 4;
}
