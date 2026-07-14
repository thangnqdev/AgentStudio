import { useState } from 'react';
import { useProviderSettings } from '../../application/hooks/useProviderSettings';
import { parseProviderModelInput } from '../../application/services/providerModelInput';
import type { AIProvider } from '../../domain/entities/settings';
import { useAppStore } from '../../store/useAppStore';
import { ProviderEditor } from './ProviderEditor';
import { ProviderList } from './ProviderList';
import type { ProviderDraft, ProviderSaveMode } from './providerSettingsTypes';

export function ProviderSettingsPanel() {
  const settings = useAppStore((state) => state.settings);
  const { deleteProvider, setActiveProvider, saveProvider, saveProviderAndScan } = useProviderSettings();
  const [draft, setDraft] = useState<ProviderDraft | null>(null);
  const [loadingMode, setLoadingMode] = useState<ProviderSaveMode | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const editProvider = (provider: AIProvider) => {
    setDraft(toDraft(provider));
    clearMessages();
  };

  const addProvider = () => {
    setDraft({
      id: crypto.randomUUID(),
      name: 'New Provider',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      models: [],
      modelInput: '',
      hasApiKey: false,
    });
    clearMessages();
  };

  const deleteOne = async (providerId: string) => {
    clearMessages();
    try {
      await deleteProvider(providerId);
      if (draft?.id === providerId) setDraft(null);
    } catch (error) {
      setErrorMessage(messageFrom(error, 'Xóa provider thất bại.'));
    }
  };

  const activate = async (providerId: string) => {
    clearMessages();
    try {
      await setActiveProvider(providerId);
    } catch (error) {
      setErrorMessage(messageFrom(error, 'Đặt provider mặc định thất bại.'));
    }
  };

  const save = async (mode: ProviderSaveMode) => {
    if (!draft) return;
    setLoadingMode(mode);
    clearMessages();
    try {
      const basePayload = {
        id: draft.id,
        name: draft.name,
        baseUrl: draft.baseUrl,
        apiKey: draft.apiKey,
      };
      const nextSettings = mode === 'scan'
        ? await saveProviderAndScan(basePayload)
        : await saveProvider({
          ...basePayload,
          models: parseProviderModelInput(draft.modelInput, draft.models),
        });
      const updated = nextSettings.providers.find((provider) => provider.id === draft.id);
      if (updated) setDraft(toDraft(updated));
      setSuccessMessage(mode === 'scan'
        ? `Đã lưu và quét được ${updated?.models.length ?? 0} model.`
        : `Đã lưu provider với ${updated?.models.length ?? 0} model.`);
    } catch (error) {
      setErrorMessage(messageFrom(error, 'Không thể lưu provider.'));
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <>
      <ProviderList
        providers={settings.providers}
        activeProviderId={settings.activeProviderId}
        onAdd={addProvider}
        onEdit={editProvider}
        onDelete={(providerId) => void deleteOne(providerId)}
        onActivate={(providerId) => void activate(providerId)}
      />
      {draft && (
        <ProviderEditor
          draft={draft}
          isExisting={settings.providers.some((provider) => provider.id === draft.id)}
          loadingMode={loadingMode}
          errorMessage={errorMessage}
          successMessage={successMessage}
          onChange={(patch) => setDraft((current) => current ? { ...current, ...patch } : current)}
          onClose={() => setDraft(null)}
          onSave={(mode) => void save(mode)}
        />
      )}
    </>
  );
}

function toDraft(provider: AIProvider): ProviderDraft {
  return {
    ...provider,
    apiKey: '',
    models: provider.models.map((model) => ({ ...model })),
    modelInput: provider.models.map((model) => model.id).join('\n'),
  };
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
