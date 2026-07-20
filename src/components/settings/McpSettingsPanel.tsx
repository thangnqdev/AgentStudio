import { useState } from 'react';
import { useMcpServers } from '../../application/hooks/useMcpServers';
import type { McpServerStatus, SaveMcpServerPayload } from '../../domain/entities/mcp';
import { McpServerForm } from './McpServerForm';

export function McpSettingsPanel() {
  const { servers, error, loading, save, remove, start, stop, authenticate } = useMcpServers();
  const [editing, setEditing] = useState<McpServerStatus | 'new' | null>(null);
  const handleSave = async (payload: SaveMcpServerPayload) => { await save(payload); setEditing(null); };
  return (
    <section id="mcp-settings" tabIndex={-1} className="outline-none">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-ui-label-bold text-[16px] text-primary">Model Context Protocol</h3>
        <button onClick={() => setEditing('new')} className="px-3 py-1.5 bg-secondary text-white rounded text-[13px]">Thêm server</button>
      </div>
      <p className="text-[13px] text-on-surface-variant mb-4">Server chỉ được thêm từ UI. stdio chạy bằng command + args, không qua shell và chỉ nhận safe env cùng credentials đã cấu hình.</p>
      {editing && <McpServerForm server={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSave={handleSave} />}
      {loading && <p className="text-[13px] text-on-surface-variant mt-3">Đang tải MCP servers…</p>}
      <div className="grid gap-3 mt-4">
        {servers.map((server) => (
          <div key={server.id} className="p-4 rounded-xl border border-outline-variant bg-surface-container-lowest">
            <div className="flex justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><h4 className="font-ui-label-bold text-[14px]">{server.name}</h4><Status state={server.state} /></div>
                <p className="text-[11px] font-code-base text-on-surface-variant mt-1 break-all">{describeTransport(server)}</p>
                <p className="text-[12px] mt-1">{server.toolCount} tools · risk: {server.defaultRisk}{server.autoStart ? ' · auto-start' : ''}{server.hasCredentials ? ' · credential saved' : ''}</p>
                {server.state === 'needs-auth' && <p className="text-[12px] text-[#ed6c02] mt-1">Cần xác thực OAuth trong trình duyệt.</p>}
                {server.error && <p className="text-[12px] text-error mt-1">{server.error}</p>}
              </div>
              <div className="flex items-start gap-2">
                {server.state === 'needs-auth' && <button onClick={() => void authenticate(server.id)} className="settings-action">Xác thực</button>}
                {server.state === 'connected'
                  ? <button onClick={() => void stop(server.id)} className="settings-action">Dừng</button>
                  : <button onClick={() => void start(server.id)} className="settings-action">Khởi động</button>}
                <button onClick={() => setEditing(server)} className="settings-action">Sửa</button>
                <button onClick={() => void remove(server.id)} className="settings-action text-error">Xóa</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-[13px] text-error mt-3">{error}</p>}
    </section>
  );
}

function Status({ state }: { state: McpServerStatus['state'] }) {
  const color = state === 'connected'
    ? 'bg-[#2e7d32]'
    : state === 'error'
      ? 'bg-error'
      : state === 'needs-auth'
        ? 'bg-[#ed6c02]'
        : 'bg-on-surface-variant';
  return <span className={`text-white text-[10px] uppercase px-2 py-0.5 rounded ${color}`}>{state}</span>;
}

function describeTransport(server: McpServerStatus) {
  return server.transport.type === 'stdio' ? `${server.transport.command} ${server.transport.args.join(' ')}` : server.transport.url;
}
