import { useState } from 'react';
import { useAppStore, type AIProvider } from '../store/useAppStore';
import { fetchAvailableModels } from '../services/ai';

export function SettingsView() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  const [editingProvider, setEditingProvider] = useState<Partial<AIProvider> | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const providers = settings.providers || [];

  const handleAddNew = () => {
    setEditingProvider({
      id: Math.random().toString(36).substring(7),
      name: 'New Provider',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      models: [],
    });
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleEdit = (p: AIProvider) => {
    setEditingProvider({ ...p });
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleDelete = (id: string) => {
    const newProviders = providers.filter(p => p.id !== id);
    let newActiveId = settings.activeProviderId;
    if (newActiveId === id) {
      newActiveId = newProviders.length > 0 ? newProviders[0].id : null;
    }
    setSettings({ 
      providers: newProviders,
      activeProviderId: newActiveId
    });
    if (editingProvider?.id === id) {
      setEditingProvider(null);
    }
  };

  const handleSetDefault = (id: string) => {
    setSettings({ activeProviderId: id });
  };

  const handleSaveAndScan = async () => {
    if (!editingProvider || !editingProvider.id) return;
    
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      let finalUrl = (editingProvider.baseUrl || '').trim();
      if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'http://' + finalUrl;
      }
      
      const apiKey = editingProvider.apiKey || '';
      const name = editingProvider.name || 'Unnamed';

      // Scan models
      let models: string[] = [];
      try {
        models = await fetchAvailableModels(finalUrl, apiKey);
      } catch (e) {
        throw new Error(`Quét model thất bại: ${e instanceof Error ? e.message : 'Unknown'}`);
      }

      const updatedProvider: AIProvider = {
        id: editingProvider.id,
        name,
        baseUrl: finalUrl,
        apiKey,
        models,
      };

      const existingIndex = providers.findIndex(p => p.id === updatedProvider.id);
      let newProviders = [...providers];
      
      if (existingIndex >= 0) {
        newProviders[existingIndex] = updatedProvider;
      } else {
        newProviders.push(updatedProvider);
      }

      let newActiveId = settings.activeProviderId;
      if (!newActiveId || existingIndex < 0 && providers.length === 0) {
        newActiveId = updatedProvider.id;
      }
      
      // Select first model if none active, or current is invalid
      let newActiveModel = settings.activeModelId;
      if (newActiveId === updatedProvider.id) {
         if (models.length > 0 && !models.includes(newActiveModel || '')) {
           newActiveModel = models[0];
         } else if (models.length > 0 && !newActiveModel) {
           newActiveModel = models[0];
         }
      }

      setSettings({
        providers: newProviders,
        activeProviderId: newActiveId,
        activeModelId: newActiveModel
      });
      
      setSuccessMsg(`Lưu thành công. Đã tìm thấy ${models.length} model.`);
      setEditingProvider(updatedProvider); // keep it open
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Lỗi không xác định.');
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
          <h2 className="font-display-serif text-[32px] leading-tight text-primary">Cài đặt AI</h2>
          <p className="font-ui-body text-ui-body text-on-surface-variant mt-2">
            Quản lý các cấu hình kết nối AI (Providers). Bạn có thể thêm nhiều nhà cung cấp khác nhau.
          </p>
        </div>

        {/* List of Providers */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-ui-label-bold text-[16px] text-primary">Danh sách cấu hình</h3>
            <button 
              onClick={handleAddNew}
              className="px-3 py-1.5 bg-secondary text-white rounded font-ui-label-bold text-[13px] flex items-center gap-1 hover:bg-[#7D2C11] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Thêm mới
            </button>
          </div>
          
          <div className="grid gap-3">
            {providers.length === 0 ? (
              <p className="text-on-surface-variant text-[14px]">Chưa có cấu hình nào.</p>
            ) : (
              providers.map(p => {
                const isActive = p.id === settings.activeProviderId;
                return (
                  <div key={p.id} className={`flex items-center justify-between p-4 rounded-xl border ${isActive ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface-container-lowest'}`}>
                    <div className="flex-1 cursor-pointer" onClick={() => handleEdit(p)}>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-ui-label-bold text-[15px] text-on-surface">{p.name}</h4>
                        {isActive && <span className="px-2 py-0.5 bg-primary text-white text-[10px] rounded uppercase font-ui-label-bold tracking-wider">Mặc định</span>}
                      </div>
                      <p className="text-[12px] text-on-surface-variant font-code-base">{p.baseUrl}</p>
                      <p className="text-[12px] text-on-surface-variant mt-1">{p.models?.length || 0} models đã lưu</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {!isActive && (
                        <button 
                          onClick={() => handleSetDefault(p.id)}
                          className="px-3 py-1.5 rounded text-[13px] border border-outline-variant hover:bg-surface-container transition-colors"
                          title="Đặt làm mặc định"
                        >
                          Mặc định
                        </button>
                      )}
                      <button 
                        onClick={() => handleEdit(p)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container text-on-surface-variant"
                        title="Chỉnh sửa"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(p.id)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-error/10 text-error transition-colors"
                        title="Xóa"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Edit Form */}
        {editingProvider && (
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm relative mt-4">
            <button 
              onClick={() => setEditingProvider(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <h3 className="font-ui-label-bold text-[16px] text-primary mb-6">
              {providers.some(p => p.id === editingProvider.id) ? 'Chỉnh sửa cấu hình' : 'Thêm cấu hình mới'}
            </h3>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="block font-ui-label-bold text-on-surface">Tên gợi nhớ</label>
                <input
                  type="text"
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2 text-[14px] focus:border-secondary outline-none"
                  value={editingProvider.name || ''}
                  onChange={(e) => setEditingProvider({...editingProvider, name: e.target.value})}
                  placeholder="Ví dụ: Ollama Local"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-ui-label-bold text-on-surface">Đường dẫn (Base URL) <span className="text-error">*</span></label>
                <input
                  type="url"
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2 text-[14px] focus:border-secondary outline-none"
                  value={editingProvider.baseUrl || ''}
                  onChange={(e) => setEditingProvider({...editingProvider, baseUrl: e.target.value})}
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-ui-label-bold text-on-surface">Khóa API (API Key)</label>
                <input
                  type="password"
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2 text-[14px] focus:border-secondary outline-none"
                  value={editingProvider.apiKey || ''}
                  onChange={(e) => setEditingProvider({...editingProvider, apiKey: e.target.value})}
                  placeholder="Để trống nếu không cần"
                />
              </div>
              
              <div className="pt-4 flex items-center gap-3">
                <button
                  onClick={handleSaveAndScan}
                  disabled={isLoading}
                  className={`px-4 py-2 rounded-lg font-ui-label-bold text-[14px] transition-colors flex items-center gap-2 ${isLoading ? 'bg-surface-container text-on-surface-variant' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
                >
                  {isLoading ? (
                    <><span className="material-symbols-outlined animate-spin text-[18px]">sync</span> Đang lưu...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[18px]">save</span> Lưu & Quét Model</>
                  )}
                </button>
              </div>

              {errorMsg && <p className="text-[13px] text-error">{errorMsg}</p>}
              {successMsg && <p className="text-[13px] text-[#4caf50]">{successMsg}</p>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

