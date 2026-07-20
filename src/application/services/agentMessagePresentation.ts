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

type ToolCopy = {
  action: string;
  running: string;
  completed: string;
};

const TOOL_COPY: Record<string, ToolCopy> = {
  agent: { action: 'Tạo agent hỗ trợ', running: 'Đang tạo agent hỗ trợ…', completed: 'Đã tạo agent hỗ trợ' },
  sendmessage: { action: 'Trao đổi với agent', running: 'Đang trao đổi với agent…', completed: 'Đã trao đổi với agent' },
  toolsearch: { action: 'Tìm công cụ', running: 'Đang tìm công cụ phù hợp…', completed: 'Đã tìm thấy công cụ phù hợp' },
  tool_search: { action: 'Tìm công cụ', running: 'Đang tìm công cụ phù hợp…', completed: 'Đã tìm thấy công cụ phù hợp' },
  read_file: { action: 'Đọc tệp', running: 'Đang đọc tệp…', completed: 'Đã đọc tệp' },
  read: { action: 'Đọc nội dung', running: 'Đang đọc nội dung…', completed: 'Đã đọc nội dung' },
  list_files: { action: 'Duyệt tệp', running: 'Đang duyệt tệp…', completed: 'Đã duyệt tệp' },
  glob: { action: 'Tìm tệp', running: 'Đang tìm tệp…', completed: 'Đã tìm tệp' },
  grep: { action: 'Tìm trong tệp', running: 'Đang tìm trong tệp…', completed: 'Đã tìm trong tệp' },
  write_file: { action: 'Cập nhật tệp', running: 'Đang cập nhật tệp…', completed: 'Đã cập nhật tệp' },
  write: { action: 'Ghi tệp', running: 'Đang ghi tệp…', completed: 'Đã ghi tệp' },
  edit: { action: 'Chỉnh sửa tệp', running: 'Đang chỉnh sửa tệp…', completed: 'Đã chỉnh sửa tệp' },
  apply_patch: { action: 'Áp dụng thay đổi', running: 'Đang áp dụng thay đổi…', completed: 'Đã áp dụng thay đổi' },
  run_command: { action: 'Chạy lệnh', running: 'Đang chạy lệnh…', completed: 'Đã chạy lệnh' },
  bash: { action: 'Chạy lệnh', running: 'Đang chạy lệnh…', completed: 'Đã chạy lệnh' },
  powershell: { action: 'Chạy lệnh', running: 'Đang chạy lệnh…', completed: 'Đã chạy lệnh' },
  task_create: { action: 'Tạo đầu việc', running: 'Đang tạo đầu việc…', completed: 'Đã tạo đầu việc' },
  task_update: { action: 'Cập nhật đầu việc', running: 'Đang cập nhật đầu việc…', completed: 'Đã cập nhật đầu việc' },
  task_get: { action: 'Xem đầu việc', running: 'Đang xem đầu việc…', completed: 'Đã xem đầu việc' },
  task_list: { action: 'Xem danh sách việc', running: 'Đang xem danh sách việc…', completed: 'Đã xem danh sách việc' },
  webfetch: { action: 'Đọc trang web', running: 'Đang đọc trang web…', completed: 'Đã đọc trang web' },
  web_fetch: { action: 'Đọc trang web', running: 'Đang đọc trang web…', completed: 'Đã đọc trang web' },
  websearch: { action: 'Tìm kiếm trên web', running: 'Đang tìm kiếm trên web…', completed: 'Đã tìm kiếm trên web' },
  web_search: { action: 'Tìm kiếm trên web', running: 'Đang tìm kiếm trên web…', completed: 'Đã tìm kiếm trên web' },
  evaluate: { action: 'Đánh giá kết quả', running: 'Đang đánh giá kết quả…', completed: 'Đã đánh giá kết quả' },
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
  const awaitingActions = actions.filter((action) => action.status === 'awaiting_approval');
  const runningActions = actions.filter((action) => action.status === 'running');
  const failedActions = actions.filter((action) => action.status === 'error');
  const deniedActions = actions.filter((action) => action.status === 'denied');
  const completed = actions.filter((action) => action.status === 'ok').length;
  const preview = compactPreview(actions.map(toolActionLabel));
  if (awaitingActions.length) return { title: `${awaitingActions.length} bước cần bạn cho phép`, preview, icon: 'approval', tone: 'approval', autoOpen: true };
  if (runningActions.length) {
    const activeAction = runningActions.at(-1)!;
    const progress = actions.length > 1 ? `${completed}/${actions.length} bước đã xong` : '';
    return { title: toolActionRunningLabel(activeAction), preview: progress, icon: 'progress_activity', tone: 'working', autoOpen: false };
  }
  if (failedActions.length || deniedActions.length) {
    const problemCount = failedActions.length + deniedActions.length;
    const title = failedActions.length
      ? `${problemCount} bước gặp lỗi`
      : `${deniedActions.length} bước đã bị từ chối`;
    return { title, preview, icon: 'error', tone: 'error', autoOpen: true };
  }
  if (actions.length === 1) return { title: toolActionCompletedLabel(actions[0]), preview: '', icon: 'check_circle', tone: 'success', autoOpen: false };
  return { title: `Đã hoàn tất ${actions.length} bước`, preview, icon: 'check_circle', tone: 'success', autoOpen: false };
}

export function toolActionLabel(action: AgentAction) {
  return TOOL_COPY[normalizeToolName(action.toolName)]?.action ?? humanizeIdentifier(action.toolName);
}

export function toolActionRunningLabel(action: AgentAction) {
  return TOOL_COPY[normalizeToolName(action.toolName)]?.running ?? `Đang dùng ${humanizeIdentifier(action.toolName).toLocaleLowerCase('vi-VN')}…`;
}

export function toolActionCompletedLabel(action: AgentAction) {
  return TOOL_COPY[normalizeToolName(action.toolName)]?.completed ?? `Đã hoàn tất ${humanizeIdentifier(action.toolName).toLocaleLowerCase('vi-VN')}`;
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

function normalizeToolName(value: string) {
  return value.toLowerCase().replaceAll('-', '_');
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
