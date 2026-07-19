import { describe, expect, it } from 'vitest';
import { agentActivitySummary, agentRoleLabel, permissionModeLabel, toolActivityLabel } from './agentDisplay';

describe('agentDisplay', () => {
  it('uses human labels for roles and permissions', () => {
    expect(agentRoleLabel('subagent')).toBe('Agent phụ');
    expect(permissionModeLabel('danger-full-access')).toBe('Toàn quyền dự án');
  });

  it('summarizes implementation tools by user intent', () => {
    expect(toolActivityLabel('read_file')).toBe('Đang tìm hiểu');
    expect(toolActivityLabel('run_command')).toBe('Đang chạy công cụ');
  });

  it('reports the settled state instead of saying completed agents are waiting', () => {
    expect(agentActivitySummary({ total: 2, working: 0, idle: 0, completed: 2, attention: 0 }))
      .toMatchObject({ title: 'Đã hoàn tất', status: 'Đã xong' });
    expect(agentActivitySummary({ total: 2, working: 1, idle: 0, completed: 1, attention: 0 }))
      .toMatchObject({ title: 'Đang thực hiện', status: '1 đang làm' });
    expect(agentActivitySummary({ total: 2, working: 0, idle: 0, completed: 2, attention: 0 }, true))
      .toMatchObject({ title: 'Agent chính đang tổng hợp', status: 'Đang tổng hợp' });
  });
});
