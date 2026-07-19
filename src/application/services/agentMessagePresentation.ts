import type { AgentAction } from '../../domain/entities/message';
import type { AgentContentPart } from './parseAgentContent';

export type AgentMessageBlock =
  | Exclude<AgentContentPart, { type: 'tool' }>
  | { type: 'tool-group'; actions: AgentAction[] };

export type ToolProgressSummary = {
  title: string;
  preview: string;
  icon: string;
  tone: 'working' | 'approval' | 'success' | 'error';
  autoOpen: boolean;
};

export function buildAgentMessageBlocks(parts: AgentContentPart[], actions: AgentAction[]): AgentMessageBlock[] {
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const referenced = new Set<string>();
  const blocks: AgentMessageBlock[] = [];
  let group: AgentAction[] = [];

  const flush = () => {
    if (group.length) blocks.push({ type: 'tool-group', actions: group });
    group = [];
  };

  for (const part of parts) {
    if (part.type === 'tool') {
      const action = part.action ?? actionById.get(part.actionId);
      if (action && !referenced.has(action.id)) {
        referenced.add(action.id);
        group.push(action);
      }
      continue;
    }
    if (part.type === 'text' && !part.value.trim() && group.length) continue;
    flush();
    blocks.push(part);
  }
  flush();

  const unreferenced = actions.filter((action) => !referenced.has(action.id));
  if (unreferenced.length) blocks.push({ type: 'tool-group', actions: unreferenced });
  return blocks;
}

export function summarizeToolProgress(actions: AgentAction[]): ToolProgressSummary {
  const awaiting = actions.filter((action) => action.status === 'awaiting_approval').length;
  const running = actions.filter((action) => action.status === 'running').length;
  const errors = actions.filter((action) => action.status === 'error' || action.status === 'denied').length;
  const completed = actions.filter((action) => action.status === 'ok').length;
  const preview = compactPreview(actions.map(toolActionLabel));
  if (awaiting) return { title: `${awaiting} bước cần bạn`, preview, icon: 'approval', tone: 'approval', autoOpen: true };
  if (running) return { title: `Đang thực hiện · ${completed}/${actions.length} bước`, preview, icon: 'progress_activity', tone: 'working', autoOpen: true };
  if (errors) return { title: `Đã chạy ${actions.length} bước · ${errors} lỗi`, preview, icon: 'error', tone: 'error', autoOpen: true };
  return { title: `Đã hoàn tất ${actions.length} bước`, preview, icon: 'check_circle', tone: 'success', autoOpen: false };
}

export function toolActionLabel(action: AgentAction) {
  const name = action.toolName.toLowerCase().replaceAll('-', '_');
  const labels: Record<string, string> = {
    agent: 'Tạo agent phụ', sendmessage: 'Trao đổi với agent', toolsearch: 'Tìm công cụ',
    read_file: 'Đọc tệp', list_files: 'Duyệt tệp', write_file: 'Cập nhật tệp',
    run_command: 'Chạy lệnh', task_create: 'Tạo đầu việc', task_update: 'Cập nhật đầu việc',
    task_get: 'Xem đầu việc', task_list: 'Xem danh sách việc', webfetch: 'Đọc trang web',
    websearch: 'Tìm kiếm web', evaluate: 'Đánh giá kết quả',
  };
  return labels[name] ?? humanizeIdentifier(action.toolName);
}

export function toolActionHint(action: AgentAction) {
  const keys = ['description', 'path', 'command', 'query', 'name', 'taskId', 'task_id', 'to'];
  const args = parseArgs(action.args);
  const output = action.output ? parseArgs(action.output) : null;
  const value = (args && firstText(args, keys)) || (output && firstText(output, keys));
  return value ? truncate(value, 100) : '';
}

function compactPreview(labels: string[]) {
  const unique = [...new Set(labels)];
  const visible = unique.slice(0, 3).join(' · ');
  return unique.length > 3 ? `${visible} · +${unique.length - 3}` : visible;
}

function humanizeIdentifier(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll(/[_-]+/g, ' ').trim() || 'Công cụ';
}

function parseArgs(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

function firstText(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (typeof value[key] === 'string' && value[key]) return value[key];
  return '';
}

function truncate(value: string, maximum: number) {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}
