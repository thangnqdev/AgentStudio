import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AgentAction } from '../../domain/entities/message';
import { ToolProgressGroup } from './ToolProgressGroup';

describe('ToolProgressGroup', () => {
  it('renders a running tool as compact live text without the details frame', () => {
    const html = renderToStaticMarkup(<ToolProgressGroup actions={[action('ToolSearch', 'running')]} />);

    expect(html).toContain('Đang tìm công cụ phù hợp…');
    expect(html).toContain('tool-status-pulse');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Chi tiết');
    expect(html).not.toContain('raw-running-args');
  });

  it('renders a completed tool as compact success text with hidden details', () => {
    const html = renderToStaticMarkup(<ToolProgressGroup actions={[action('ToolSearch', 'ok')]} />);

    expect(html).toContain('Đã tìm thấy công cụ phù hợp');
    expect(html).toContain('check_circle');
    expect(html).not.toContain('raw-running-args');
  });

  it('keeps approval actions in an attention card with technical details collapsed', () => {
    const html = renderToStaticMarkup(<ToolProgressGroup actions={[action('run_command', 'awaiting_approval')]} />);

    expect(html).toContain('1 bước cần bạn cho phép');
    expect(html).toContain('Cho phép');
    expect(html).toContain('Từ chối');
    expect(html).toContain('<details');
    expect(html).not.toContain('<details open');
    expect(html).toContain('Chi tiết kỹ thuật');
  });

  it('keeps errors in an attention card and offers a real retry action', () => {
    const html = renderToStaticMarkup(<ToolProgressGroup actions={[action('web_search', 'error')]} onRetry={() => undefined} />);

    expect(html).toContain('1 bước gặp lỗi');
    expect(html).toContain('Không thể hoàn tất bước này.');
    expect(html).toContain('Thử lại');
  });
});

function action(toolName: string, status: AgentAction['status']): AgentAction {
  return {
    id: `action-${toolName}`,
    requestId: 'request-1',
    toolName,
    args: '{"description":"raw-running-args"}',
    output: '{"result":"raw-output"}',
    risk: 'read',
    status,
  };
}
