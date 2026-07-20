import { useTheme } from '../../application/hooks/useTheme';
import type { ThemePreference } from '../../domain/entities/theme';

const OPTIONS: Array<{
  description: string;
  icon: string;
  label: string;
  previewClass: string;
  value: ThemePreference;
}> = [
  { value: 'system', label: 'Theo hệ thống', description: 'Tự đổi theo cài đặt macOS hoặc Windows.', icon: 'computer', previewClass: 'theme-preview-system' },
  { value: 'light', label: 'Sáng', description: 'Luôn dùng giao diện nền sáng.', icon: 'light_mode', previewClass: 'theme-preview-light' },
  { value: 'dark', label: 'Tối', description: 'Luôn dùng giao diện nền tối.', icon: 'dark_mode', previewClass: 'theme-preview-dark' },
];

export function AppearanceSettingsPanel() {
  const { preference, resolvedTheme, isSaving, error, setPreference } = useTheme();

  return (
    <section aria-labelledby="appearance-heading">
      <div className="mb-6">
        <h3 id="appearance-heading" className="text-[16px] font-semibold text-primary">Giao diện</h3>
        <p className="mt-1 text-[13px] text-on-surface-variant">
          Chọn cách AgentStudio hiển thị. Chế độ đang áp dụng: {resolvedTheme === 'dark' ? 'Tối' : 'Sáng'}.
        </p>
      </div>
      <fieldset className="grid grid-cols-3 gap-3 max-[720px]:grid-cols-1">
        <legend className="sr-only">Chế độ giao diện</legend>
        {OPTIONS.map((option) => {
          const selected = preference === option.value;
          return (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl border p-3 text-left transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-secondary ${isSaving ? 'opacity-60' : ''} ${selected ? 'border-secondary bg-secondary-container/35 ring-1 ring-secondary/30' : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'}`}
            >
              <input
                type="radio"
                name="theme-preference"
                value={option.value}
                checked={selected}
                disabled={isSaving}
                onChange={() => void setPreference(option.value)}
                className="sr-only"
              />
              <span className={`theme-preview ${option.previewClass}`} aria-hidden="true"><span /></span>
              <span className="mt-3 flex items-center gap-2 text-[13px] font-medium text-on-surface">
                <span className="material-symbols-outlined text-[17px]">{option.icon}</span>{option.label}
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-on-surface-variant">{option.description}</span>
            </label>
          );
        })}
      </fieldset>
      {error && <p className="mt-4 text-[12px] text-error" role="alert">{error}</p>}
    </section>
  );
}
