import type { ProviderDraft, ProviderSaveMode } from './providerSettingsTypes';

interface ProviderEditorProps {
  draft: ProviderDraft;
  isExisting: boolean;
  loadingMode: ProviderSaveMode | null;
  errorMessage: string;
  successMessage: string;
  onChange: (patch: Partial<ProviderDraft>) => void;
  onClose: () => void;
  onSave: (mode: ProviderSaveMode) => void;
}

export function ProviderEditor({
  draft,
  isExisting,
  loadingMode,
  errorMessage,
  successMessage,
  onChange,
  onClose,
  onSave,
}: ProviderEditorProps) {
  const isLoading = loadingMode !== null;

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm relative mt-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-surface-container text-on-surface-variant"
        title="Đóng"
      >
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
      <h3 className="font-ui-label-bold text-[16px] text-primary mb-6">
        {isExisting ? 'Chỉnh sửa cấu hình' : 'Thêm cấu hình mới'}
      </h3>

      <div className="space-y-5">
        <Field label="Tên gợi nhớ">
          <input
            type="text"
            className={inputClassName}
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Ví dụ: Ollama Local"
          />
        </Field>
        <Field label="Đường dẫn (Base URL)" required>
          <input
            type="url"
            className={inputClassName}
            value={draft.baseUrl}
            onChange={(event) => onChange({ baseUrl: event.target.value })}
            placeholder="http://localhost:20128/v1"
          />
        </Field>
        <Field label="Khóa API (API Key)">
          <input
            type="password"
            className={inputClassName}
            value={draft.apiKey}
            onChange={(event) => onChange({ apiKey: event.target.value })}
            placeholder={draft.hasApiKey ? 'Để trống để giữ khóa hiện tại' : 'Để trống nếu không cần'}
          />
        </Field>
        <Field label="Model thủ công">
          <textarea
            className={`${inputClassName} min-h-24 resize-y font-code-base`}
            value={draft.modelInput}
            onChange={(event) => onChange({ modelInput: event.target.value })}
            placeholder={'model-id-1\nmodel-id-2'}
          />
          <p className="text-[12px] text-on-surface-variant">
            Mỗi dòng một model, hoặc phân tách bằng dấu phẩy. “Lưu provider” không gọi mạng.
          </p>
        </Field>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <ActionButton
            disabled={isLoading}
            icon="save"
            label={loadingMode === 'manual' ? 'Đang lưu...' : 'Lưu provider'}
            onClick={() => onSave('manual')}
            spinning={loadingMode === 'manual'}
          />
          <ActionButton
            disabled={isLoading}
            icon="sync"
            label={loadingMode === 'scan' ? 'Đang quét...' : 'Lưu & quét model'}
            onClick={() => onSave('scan')}
            secondary
            spinning={loadingMode === 'scan'}
          />
        </div>
        {errorMessage && <p className="text-[13px] text-error">{errorMessage}</p>}
        {successMessage && <p className="text-[13px] text-success">{successMessage}</p>}

        {draft.models.length > 0 && (
          <div className="pt-4 border-t border-outline-variant">
            <h4 className="font-ui-label-bold text-[14px] mb-3">Danh sách model ({draft.models.length})</h4>
            <ul className="max-h-[200px] overflow-y-auto bg-surface-container rounded-lg border border-outline-variant divide-y divide-outline-variant">
              {draft.models.map((model) => (
                <li key={model.id} className="px-4 py-2 text-[13px] font-code-base">{model.id}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block font-ui-label-bold text-on-surface">
        {label} {required && <span className="text-error">*</span>}
      </label>
      {children}
    </div>
  );
}

function ActionButton({ disabled, icon, label, onClick, secondary = false, spinning = false }: {
  disabled: boolean;
  icon: string;
  label: string;
  onClick: () => void;
  secondary?: boolean;
  spinning?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg font-ui-label-bold text-[14px] flex items-center gap-2 ${disabled ? 'bg-surface-container text-on-surface-variant' : secondary ? 'border border-primary text-primary hover:bg-primary/5' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
    >
      <span className={`material-symbols-outlined text-[18px] ${spinning ? 'animate-spin' : ''}`}>{icon}</span>
      {label}
    </button>
  );
}

const inputClassName = 'w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2 text-[14px] focus:border-secondary outline-none';
