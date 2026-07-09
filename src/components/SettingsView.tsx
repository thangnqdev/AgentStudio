import { useAppStore } from '../store/useAppStore';

export function SettingsView() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      <div className="max-w-[800px] mx-auto w-full px-6 pt-12 flex flex-col gap-8">
        
        {/* Header */}
        <div className="border-b border-outline-variant pb-6">
          <div className="flex items-center gap-2 text-secondary mb-2">
            <span className="material-symbols-outlined text-[18px]">settings</span>
            <span className="font-ui-label-caps text-ui-label-caps uppercase tracking-wider">Cấu hình</span>
          </div>
          <h2 className="font-display-serif text-[32px] leading-tight text-primary">Cài đặt</h2>
          <p className="font-ui-body text-ui-body text-on-surface-variant mt-2">
            Cấu hình nhà cung cấp AI của bạn. Các giá trị này được lưu trữ cục bộ trên máy của bạn.
          </p>
        </div>

        {/* AI Provider Settings */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <h3 className="font-ui-label-bold text-[16px] text-primary mb-6">Cấu hình mô hình AI</h3>
          
          <div className="space-y-6">
            {/* Base URL */}
            <div className="space-y-2">
              <label htmlFor="baseUrl" className="block font-ui-label-bold text-ui-label-bold text-on-surface">
                Đường dẫn (Base URL) <span className="text-error">*</span>
              </label>
              <input
                id="baseUrl"
                type="url"
                required
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2.5 font-ui-body text-[14px] text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                placeholder="https://api.openai.com/v1"
                value={settings.baseUrl}
                onChange={(e) => setSettings({ baseUrl: e.target.value })}
              />
              <p className="text-[12px] text-on-surface-variant">
                Đường dẫn gốc (Endpoint URL) tới API của nhà cung cấp AI.
              </p>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <label htmlFor="apiKey" className="block font-ui-label-bold text-ui-label-bold text-on-surface">
                Khóa API (API Key) <span className="text-on-surface-variant/50 font-normal">(Không bắt buộc)</span>
              </label>
              <input
                id="apiKey"
                type="password"
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2.5 font-ui-body text-[14px] text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
                placeholder="sk-..."
                value={settings.apiKey}
                onChange={(e) => setSettings({ apiKey: e.target.value })}
              />
              <p className="text-[12px] text-on-surface-variant">
                Khóa API bí mật của bạn. Nếu hệ thống không yêu cầu xác thực, hãy để trống.
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
