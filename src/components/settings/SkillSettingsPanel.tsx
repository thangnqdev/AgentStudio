import { useSkills } from '../../application/hooks/useSkills';

export function SkillSettingsPanel() {
  const { skills, error, loading, refresh, setEnabled, setTrusted, install, remove } = useSkills();
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-ui-label-bold text-[16px] text-primary">Agent Skills</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void refresh()} className="settings-action">Quét lại</button>
          <button onClick={() => void install()} className="rounded bg-secondary px-3 py-1.5 text-[12px] text-on-secondary">Nhập thư mục</button>
        </div>
      </div>
      <p className="text-[13px] text-on-surface-variant mb-4">
        Đọc từ userData/skills, ~/.agents/skills và .agents/skills trong workspace. Workspace skill mặc định không được tin cậy.
      </p>
      {loading && <p className="text-[13px] text-on-surface-variant">Đang quét skills…</p>}
      {!loading && skills.length === 0 && <p className="text-[13px] text-on-surface-variant">Chưa tìm thấy SKILL.md hợp lệ.</p>}
      <div className="grid gap-3">
        {skills.map((skill) => (
          <div key={skill.id} className="p-4 rounded-xl border border-outline-variant bg-surface-container-lowest">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-[180px] flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-ui-label-bold text-[14px]">{skill.name}</h4>
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-surface-container">{skill.origin}</span>
                </div>
                <p className="text-[12px] text-on-surface-variant mt-1">{skill.description}</p>
                <p className="text-[11px] text-on-surface-variant font-code-base mt-1 break-all">{skill.rootPath}</p>
              </div>
              <label className="flex items-center gap-2 text-[12px] whitespace-nowrap">
                <input type="checkbox" checked={skill.enabled} disabled={!skill.trusted} onChange={(event) => void setEnabled(skill.id, event.target.checked)} /> Bật
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-3">
              <span className={`text-[12px] ${skill.trusted ? 'text-success' : 'text-error'}`}>
                {skill.trusted ? 'Đã tin cậy — instructions có thể vào system prompt.' : 'Chưa tin cậy — không được load.'}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => void setTrusted(skill.id, !skill.trusted)} className="px-3 py-1 rounded border border-outline-variant text-[12px] hover:bg-surface-container">
                  {skill.trusted ? 'Thu hồi tin cậy' : 'Tin cậy skill'}
                </button>
                {skill.managed && <button onClick={() => { if (window.confirm(`Xóa skill ${skill.name} khỏi AgentStudio?`)) void remove(skill.id); }} className="settings-action text-error">Xóa</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-[13px] text-error mt-3">{error}</p>}
    </section>
  );
}
