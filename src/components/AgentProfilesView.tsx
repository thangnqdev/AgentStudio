import { useAgentProfiles } from '../application/hooks/useAgentProfiles';

export function AgentProfilesView() {
  const { profiles, loading, error, refresh, setEnabled, setTrusted } = useAgentProfiles();
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-[1000px] mx-auto">
        <header className="flex items-start justify-between border-b border-outline-variant pb-5 mb-6">
          <div>
            <p className="text-ui-label-caps uppercase text-secondary">Read-only delegation</p>
            <h2 className="font-display-serif text-[30px] text-primary">Agent Profiles</h2>
            <p className="text-[13px] text-on-surface-variant mt-1">Specialized prompts for bounded subagents. Trust and enable a profile before the root agent can select it.</p>
          </div>
          <button onClick={() => void refresh()} className="settings-action">Quét lại</button>
        </header>
        {loading && <p className="text-[13px] text-on-surface-variant">Đang quét profiles…</p>}
        {!loading && profiles.length === 0 && <p className="text-[13px] text-on-surface-variant">Chưa tìm thấy agent profile Markdown hợp lệ.</p>}
        <div className="grid gap-3">
          {profiles.map((profile) => (
            <article key={profile.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><h3 className="font-ui-label-bold text-[14px]">{profile.name}</h3><span className="rounded bg-surface-container px-2 py-0.5 text-[10px] uppercase">{profile.origin}</span></div>
                  <p className="mt-1 text-[12px] text-on-surface-variant">{profile.description}</p>
                  <p className="mt-1 break-all font-code-base text-[11px] text-on-surface-variant">{profile.filePath}</p>
                  <p className="mt-2 text-[11px] text-on-surface-variant">Tools: {profile.allowedTools?.join(', ') || 'all local read tools'}</p>
                </div>
                <label className="flex items-center gap-2 whitespace-nowrap text-[12px]"><input type="checkbox" checked={profile.enabled} disabled={!profile.trusted} onChange={(event) => void setEnabled(profile.id, event.target.checked)} /> Bật</label>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-3">
                <span className={`text-[12px] ${profile.trusted ? 'text-[#2e7d32]' : 'text-error'}`}>{profile.trusted ? 'Đã tin cậy — có thể dùng làm subagent_type cho Agent.' : 'Chưa tin cậy — instructions không được load.'}</span>
                <button onClick={() => void setTrusted(profile.id, !profile.trusted)} className="settings-action">{profile.trusted ? 'Thu hồi tin cậy' : 'Tin cậy profile'}</button>
              </div>
            </article>
          ))}
        </div>
        {error && <p className="mt-3 text-[13px] text-error">{error}</p>}
      </div>
    </div>
  );
}
