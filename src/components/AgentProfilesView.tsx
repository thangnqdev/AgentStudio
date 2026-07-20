import { useAgentProfiles } from '../application/hooks/useAgentProfiles';

export function AgentProfilesView() {
  const { profiles, loading, error, refresh, setEnabled, setTrusted } = useAgentProfiles();
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-[1000px] mx-auto">
        <header className="flex items-start justify-between border-b border-outline-variant pb-5 mb-6">
          <div>
            <p className="text-ui-label-caps uppercase text-secondary">Chuyên môn hóa</p>
            <h2 className="font-display-serif text-[30px] text-primary">Hồ sơ agent</h2>
            <p className="text-[13px] text-on-surface-variant mt-1">Bật những vai trò chuyên môn mà agent chính được phép giao việc.</p>
          </div>
          <button onClick={() => void refresh()} className="settings-action">Quét lại</button>
        </header>
        {loading && <p className="text-[13px] text-on-surface-variant">Đang tìm hồ sơ agent…</p>}
        {!loading && profiles.length === 0 && <p className="text-[13px] text-on-surface-variant">Chưa có hồ sơ agent hợp lệ.</p>}
        <div className="grid gap-3">
          {profiles.map((profile) => (
            <article key={profile.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><h3 className="font-ui-label-bold text-[14px]">{profile.name}</h3><span className="rounded bg-surface-container px-2 py-0.5 text-[10px] uppercase">{profile.origin}</span></div>
                  <p className="mt-1 text-[12px] text-on-surface-variant">{profile.description}</p>
                  <details className="mt-2 text-[10px] text-on-surface-variant"><summary className="cursor-pointer">Thông tin kỹ thuật</summary><p className="mt-1 break-all font-code-base">{profile.filePath}</p><p className="mt-1">Công cụ: {profile.allowedTools?.join(', ') || 'mọi công cụ đọc cục bộ'}</p></details>
                </div>
                <label className="flex items-center gap-2 whitespace-nowrap text-[12px]"><input type="checkbox" checked={profile.enabled} disabled={!profile.trusted} onChange={(event) => void setEnabled(profile.id, event.target.checked)} /> Bật</label>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-3">
                <span className={`text-[12px] ${profile.trusted ? 'text-success' : 'text-error'}`}>{profile.trusted ? 'Đã tin cậy — agent chính có thể giao việc.' : 'Chưa tin cậy — nội dung hồ sơ chưa được sử dụng.'}</span>
                <button onClick={() => void setTrusted(profile.id, !profile.trusted)} className="settings-action">{profile.trusted ? 'Thu hồi tin cậy' : 'Đánh dấu tin cậy'}</button>
              </div>
            </article>
          ))}
        </div>
        {error && <p className="mt-3 text-[13px] text-error">{error}</p>}
      </div>
    </div>
  );
}
