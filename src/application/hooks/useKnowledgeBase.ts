import { useEffect, useState } from 'react';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';
import { useAppStore } from '../../store/useAppStore';
import type { KnowledgeDocument } from '../../domain/entities/knowledge';
import type { IpcResult } from '../../types/electron';

export type KnowledgeLibrary = {
  documents: KnowledgeDocument[];
  totalChunks: number;
  semanticReady: boolean;
  watching: boolean;
};

const EMPTY_LIBRARY: KnowledgeLibrary = { documents: [], totalChunks: 0, semanticReady: false, watching: false };

function unwrapResult<T>(result: IpcResult<T>) {
  if ('error' in result) throw new Error(result.error);
  return result.data;
}

export function useKnowledgeBase() {
  const workspacePath = useAppStore((state) => state.settings.workspacePath);
  const [library, setLibrary] = useState<KnowledgeLibrary>(EMPTY_LIBRARY);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    if (!AgentBridge.isAvailable) return;
    setIsLoading(true);
    try {
      setLibrary(unwrapResult(await AgentBridge.listKnowledge()));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể tải cơ sở tri thức.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [workspacePath]);

  const importDocuments = async () => {
    setNotice('');
    setIsImporting(true);
    try {
      const imported = unwrapResult(await AgentBridge.selectAndImportKnowledge());
      if (!imported.canceled) {
        setNotice([imported.imported.length ? `Đã lập chỉ mục ${imported.imported.length} tài liệu.` : '', ...imported.warnings].filter(Boolean).join(' ') || 'Không có tài liệu mới.');
        await refresh();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể nhập tài liệu.');
    } finally {
      setIsImporting(false);
    }
  };

  const removeDocument = async (documentId: string) => {
    setNotice('');
    try {
      unwrapResult(await AgentBridge.removeKnowledgeDocument(documentId));
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể xóa tài liệu.');
    }
  };

  const toggleWorkspaceSync = async () => {
    setNotice('');
    setIsSyncing(true);
    try {
      if (library.watching) {
        unwrapResult(await AgentBridge.stopWorkspaceKnowledgeSync());
        setNotice('Đã dừng đồng bộ workspace.');
      } else {
        const result = unwrapResult(await AgentBridge.syncWorkspaceKnowledge());
        setNotice(`Đã quét ${result.scanned} tệp và bật đồng bộ workspace.${result.truncated ? ' Đã chạm giới hạn 2.000 tệp.' : ''}`);
      }
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể đồng bộ workspace.');
    } finally {
      setIsSyncing(false);
    }
  };

  return { library, isLoading, isImporting, isSyncing, notice, refresh, importDocuments, removeDocument, toggleWorkspaceSync };
}
