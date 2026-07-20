import { describe, expect, it } from 'vitest';
import type { AgentAction } from '../../domain/entities/message';
import {
  buildAgentMessageBlocks, summarizeToolProgress, toolActionCompletedLabel,
  toolActionHint, toolActionLabel, toolActionRunningLabel,
} from './agentMessagePresentation';
import { parseAgentContent } from './parseAgentContent';

describe('agentMessagePresentation', () => {
  it('groups adjacent tool markers while retaining meaningful commentary boundaries', () => {
    const actions = [action('one', 'read_file'), action('two', 'run_command'), action('three', 'task_get')];
    const blocks = buildAgentMessageBlocks(
      parseAgentContent('Chuẩn bị.\n[tool:one]\n\n[tool:two]\nĐã kiểm tra.\n[tool:three]'),
      actions,
    );

    expect(blocks.map((block) => block.type)).toEqual(['text', 'tool-group', 'text', 'tool-group']);
    expect(blocks[1]).toMatchObject({ type: 'tool-group', actions: [{ id: 'one' }, { id: 'two' }] });
  });

  it('adds actions without markers once so live progress is never hidden', () => {
    const actions = [action('one', 'read_file'), action('late', 'ToolSearch')];
    const blocks = buildAgentMessageBlocks(parseAgentContent('[tool:one]'), actions);
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toMatchObject({ type: 'tool-group', actions: [{ id: 'late' }] });
  });

  it('creates dynamic summaries for running, approval, failed and completed groups', () => {
    expect(summarizeToolProgress([action('one', 'read_file'), action('two', 'run_command', 'running')]))
      .toMatchObject({ title: 'Đang chạy lệnh…', preview: '1/2 bước đã xong', tone: 'working', autoOpen: false });
    expect(summarizeToolProgress([action('one', 'read_file', 'awaiting_approval')]))
      .toMatchObject({ title: '1 bước cần bạn cho phép', tone: 'approval', autoOpen: true });
    expect(summarizeToolProgress([action('one', 'read_file', 'error')]))
      .toMatchObject({ title: '1 bước gặp lỗi', tone: 'error', autoOpen: true });
    expect(summarizeToolProgress([action('one', 'read_file')]))
      .toMatchObject({ title: 'Đã đọc tệp', tone: 'success', autoOpen: false });
    expect(summarizeToolProgress([action('one', 'read_file'), action('two', 'ToolSearch')]))
      .toMatchObject({ title: 'Đã hoàn tất 2 bước', preview: 'Đọc tệp · Tìm công cụ', tone: 'success', autoOpen: false });
  });

  it('uses concise non-technical labels and extracts a useful argument hint', () => {
    const worker = { ...action('one', 'Agent'), args: '{"description":"Review navigation","name":"ux"}' };
    expect(toolActionLabel(worker)).toBe('Tạo agent hỗ trợ');
    expect(toolActionHint(worker)).toBe('Review navigation');
    expect(toolActionHint({ ...worker, args: '{}', output: '{"description":"Review from output"}' })).toBe('Review from output');
  });

  it('uses conversational running and completed copy for common tools', () => {
    const search = action('one', 'ToolSearch', 'running');
    expect(toolActionRunningLabel(search)).toBe('Đang tìm công cụ phù hợp…');
    expect(toolActionCompletedLabel(search)).toBe('Đã tìm thấy công cụ phù hợp');
    expect(toolActionRunningLabel(action('two', 'web_search', 'running'))).toBe('Đang tìm kiếm trên web…');
  });
});

function action(id: string, toolName: string, status: AgentAction['status'] = 'ok'): AgentAction {
  return { id, requestId: 'request', toolName, args: '{}', risk: 'read', status };
}
