import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { fetchAvailableModels } from '../services/ai';

export function SettingsView() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  const [tempBaseUrl, setTempBaseUrl] = useState(settings.baseUrl);
  const [tempApiKey, setTempApiKey] = useState(settings.apiKey);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSaveAndScan = async () => {
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      let finalUrl = tempBaseUrl.trim();
      if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'http://' + finalUrl;
        setTempBaseUrl(finalUrl);
      }

      const models = await fetchAvailableModels(finalUrl, tempApiKey);

      let newSelectedModel = settings.selectedModel;
      if (models.length > 0 && !models.includes(newSelectedModel)) {
        newSelectedModel = models[0];
      } else if (models.length > 0 && !newSelectedModel) {
        newSelectedModel = models[0];
      }

      setSettings({
        baseUrl: finalUrl,
        apiKey: tempApiKey,
        models,
        selectedModel: newSelectedModel,
      });
      setSuccessMsg(`Lưu thành công. Đã tìm thấy ${models.length} model.`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Lỗi không xác định khi quét model.');
    } finally {
      setIsLoading(false);
    }
  };

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
                value={tempBaseUrl}
                onChange={(e) => setTempBaseUrl(e.target.value)}
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
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
              />
              <p className="text-[12px] text-on-surface-variant">
                Khóa API bí mật của bạn. Nếu hệ thống không yêu cầu xác thực, hãy để trống.
              </p>
            </div>

            {/* Action Buttons & Messages */}
            <div className="pt-2">
              <button
                onClick={handleSaveAndScan}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg font-ui-label-bold text-[14px] transition-colors flex items-center gap-2
                  ${isLoading ? 'bg-surface-container text-on-surface-variant cursor-not-allowed' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                    Đang quét...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Lưu cấu hình
                  </>
                )}
              </button>

              {errorMsg && <p className="mt-3 text-[14px] text-error font-ui-body">{errorMsg}</p>}
              {successMsg && <p className="mt-3 text-[14px] text-[#4caf50] font-ui-body">{successMsg}</p>}
            </div>

            {/* Model Dropdown */}
            {settings.models && settings.models.length > 0 && (
              <div className="space-y-2 pt-6 border-t border-outline-variant">
                <label htmlFor="modelSelect" className="block font-ui-label-bold text-ui-label-bold text-on-surface">
                  Chọn Model
                </label>
                <select
                  id="modelSelect"
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2.5 font-ui-body text-[14px] text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors appearance-none"
                  value={settings.selectedModel}
                  onChange={(e) => setSettings({ selectedModel: e.target.value })}
                >
                  {settings.models.map((modelId) => (
                    <option key={modelId} value={modelId}>
                      {modelId}
                    </option>
                  ))}
                </select>
                <p className="text-[12px] text-on-surface-variant">
                  Model sẽ được sử dụng cho các tác vụ AI.
                </p>
              </div>
            )}

          </div>
        </section>

      </div>
    </div>
  );
}
