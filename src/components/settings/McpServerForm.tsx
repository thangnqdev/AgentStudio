import { useState } from 'react';
import type { McpServerStatus, McpToolRisk, SaveMcpServerPayload } from '../../domain/entities/mcp';

type Props = { server?: McpServerStatus; onCancel: () => void; onSave: (payload: SaveMcpServerPayload) => Promise<void> };

export function McpServerForm({ server, onCancel, onSave }: Props) {
  const [name, setName] = useState(server?.name ?? '');
  const [transportType, setTransportType] = useState<'stdio' | 'http'>(server?.transport.type ?? 'stdio');
  const [command, setCommand] = useState(server?.transport.type === 'stdio' ? server.transport.command : 'npx');
  const [args, setArgs] = useState(server?.transport.type === 'stdio' ? server.transport.args.join('\n') : '');
  const [url, setUrl] = useState(server?.transport.type === 'http' ? server.transport.url : 'https://');
  const [bearerToken, setBearerToken] = useState('');
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [oauthScope, setOauthScope] = useState('');
  const [environment, setEnvironment] = useState('');
  const [autoStart, setAutoStart] = useState(server?.autoStart ?? false);
  const [risk, setRisk] = useState<McpToolRisk>(server?.defaultRisk ?? 'execute');
  const [clearCredentials, setClearCredentials] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const parsedEnvironment = parseEnvironment(environment);
      const hasNewCredentials = Boolean(bearerToken || oauthClientId || oauthClientSecret || Object.keys(parsedEnvironment).length);
      await onSave({
        id: server?.id,
        name,
        transport: transportType === 'stdio'
          ? { type: 'stdio', command, args: args.split('\n').map((arg) => arg.trim()).filter(Boolean) }
          : { type: 'http', url },
        autoStart,
        defaultRisk: risk,
        clearCredentials,
        ...(hasNewCredentials ? { credentials: {
          bearerToken: bearerToken || undefined,
          oauthClientId: oauthClientId || undefined,
          oauthClientSecret: oauthClientSecret || undefined,
          oauthScope: oauthScope || undefined,
          environment: parsedEnvironment,
        } } : {}),
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="p-5 rounded-xl border border-secondary/40 bg-surface-container-lowest space-y-4">
      <div className="flex justify-between"><h4 className="font-ui-label-bold">{server ? 'Sửa MCP server' : 'Thêm MCP server'}</h4><button onClick={onCancel}>✕</button></div>
      <Field label="Tên"><input value={name} onChange={(event) => setName(event.target.value)} className="settings-input" placeholder="Filesystem tools" /></Field>
      <Field label="Transport"><select value={transportType} onChange={(event) => setTransportType(event.target.value as 'stdio' | 'http')} className="settings-input"><option value="stdio">stdio process</option><option value="http">Streamable HTTP</option></select></Field>
      {transportType === 'stdio' ? <>
        <Field label="Command (không qua shell)"><input value={command} onChange={(event) => setCommand(event.target.value)} className="settings-input font-code-base" placeholder="npx" /></Field>
        <Field label="Arguments — mỗi dòng một argument"><textarea value={args} onChange={(event) => setArgs(event.target.value)} className="settings-input font-code-base min-h-20" placeholder={'-y\n@modelcontextprotocol/server-filesystem\n/path'} /></Field>
        <Field label="Credential environment — KEY=value, được mã hóa"><textarea value={environment} onChange={(event) => setEnvironment(event.target.value)} className="settings-input font-code-base min-h-20" placeholder="API_TOKEN=…" /></Field>
      </> : <>
        <Field label="HTTPS endpoint"><input value={url} onChange={(event) => setUrl(event.target.value)} className="settings-input font-code-base" /></Field>
        <Field label="Bearer token"><input type="password" value={bearerToken} onChange={(event) => setBearerToken(event.target.value)} className="settings-input" placeholder={server?.hasCredentials ? 'Để trống để giữ credential hiện tại' : 'Tuỳ chọn'} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="OAuth client id"><input value={oauthClientId} onChange={(event) => setOauthClientId(event.target.value)} className="settings-input" placeholder="Machine-to-machine OAuth" /></Field>
          <Field label="OAuth client secret"><input type="password" value={oauthClientSecret} onChange={(event) => setOauthClientSecret(event.target.value)} className="settings-input" /></Field>
        </div>
        <Field label="OAuth scopes"><input value={oauthScope} onChange={(event) => setOauthScope(event.target.value)} className="settings-input" placeholder="tools:read tools:call" /></Field>
      </>}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Risk mặc định"><select value={risk} onChange={(event) => setRisk(event.target.value as McpToolRisk)} className="settings-input"><option value="execute">Execute</option><option value="network">Network</option><option value="write">Write</option><option value="read">Read</option></select></Field>
        <label className="flex items-center gap-2 text-[13px] pt-6"><input type="checkbox" checked={autoStart} onChange={(event) => setAutoStart(event.target.checked)} /> Tự khởi động</label>
      </div>
      {server?.hasCredentials && <label className="flex items-center gap-2 text-[12px] text-error"><input type="checkbox" checked={clearCredentials} onChange={(event) => setClearCredentials(event.target.checked)} /> Xóa credentials đã lưu khi bấm Lưu</label>}
      <p className="text-[11px] text-on-surface-variant">Nội dung từ máy chủ MCP được xem là nguồn bên ngoài. Ở chế độ “Chỉnh sửa trong dự án”, thao tác có rủi ro vẫn cần bạn cho phép; “Toàn quyền dự án” có thể chạy tự động.</p>
      <div className="flex gap-2"><button disabled={saving} onClick={() => void submit()} className="px-4 py-2 rounded bg-primary text-on-primary text-[13px]">{saving ? 'Đang lưu…' : 'Lưu server'}</button><button onClick={onCancel} className="px-4 py-2 rounded border border-outline-variant text-[13px]">Hủy</button></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[12px] font-ui-label-bold space-y-1"><span>{label}</span>{children}</label>;
}

function parseEnvironment(value: string) {
  return Object.fromEntries(value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error(`Environment entry không hợp lệ: ${line}`);
    return [line.slice(0, separator).trim(), line.slice(separator + 1)];
  }));
}
