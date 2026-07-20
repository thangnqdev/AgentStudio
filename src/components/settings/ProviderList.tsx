import type { AIProvider } from '../../domain/entities/settings';

interface ProviderListProps {
  providers: AIProvider[];
  activeProviderId: string | null;
  onAdd: () => void;
  onEdit: (provider: AIProvider) => void;
  onDelete: (providerId: string) => void;
  onActivate: (providerId: string) => void;
}

export function ProviderList({
  providers,
  activeProviderId,
  onAdd,
  onEdit,
  onDelete,
  onActivate,
}: ProviderListProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-ui-label-bold text-[16px] text-primary">Danh sách cấu hình</h3>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 bg-secondary text-on-secondary rounded font-ui-label-bold text-[13px] flex items-center gap-1 hover:bg-secondary-hover transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Thêm mới
        </button>
      </div>

      <div className="grid gap-3">
        {providers.length === 0 && (
          <p className="text-on-surface-variant text-[14px]">Chưa có cấu hình nào.</p>
        )}
        {providers.map((provider) => {
          const isActive = provider.id === activeProviderId;
          return (
            <div
              key={provider.id}
              className={`flex items-center justify-between p-4 rounded-xl border ${isActive ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface-container-lowest'}`}
            >
              <button className="flex-1 text-left" onClick={() => onEdit(provider)}>
                <span className="flex items-center gap-2 mb-1">
                  <span className="font-ui-label-bold text-[15px] text-on-surface">{provider.name}</span>
                  {isActive && (
                    <span className="px-2 py-0.5 bg-primary text-on-primary text-[10px] rounded uppercase font-ui-label-bold tracking-wider">
                      Mặc định
                    </span>
                  )}
                </span>
                <span className="block text-[12px] text-on-surface-variant font-code-base">{provider.baseUrl}</span>
                <span className="block text-[12px] text-on-surface-variant mt-1">{provider.models.length} model đã lưu</span>
              </button>
              <div className="flex items-center gap-2">
                {!isActive && (
                  <button
                    onClick={() => onActivate(provider.id)}
                    className="px-3 py-1.5 rounded text-[13px] border border-outline-variant hover:bg-surface-container transition-colors"
                  >
                    Mặc định
                  </button>
                )}
                <button onClick={() => onEdit(provider)} className="w-8 h-8 rounded hover:bg-surface-container" title="Chỉnh sửa">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button onClick={() => onDelete(provider.id)} className="w-8 h-8 rounded hover:bg-error/10 text-error" title="Xóa">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
