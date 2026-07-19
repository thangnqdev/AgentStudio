import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceFileContent, WorkspaceFileEntry } from '../../domain/entities/workspaceFile';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';

export function useWorkspaceFiles() {
  const [directory, setDirectory] = useState('.');
  const [entries, setEntries] = useState<WorkspaceFileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDirectory = useCallback(async (path = '.') => {
    setLoading(true);
    setError('');
    try {
      const result = await AgentBridge.listWorkspaceFiles({ directory: path });
      if (!result.success) throw new Error(result.error);
      setDirectory(path || '.');
      setEntries(result.data.entries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể đọc thư mục.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDirectory('.'); }, [loadDirectory]);

  const openEntry = async (entry: WorkspaceFileEntry) => {
    if (entry.kind === 'directory') {
      setSelectedFile(null);
      await loadDirectory(entry.path);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await AgentBridge.readWorkspaceFile({ path: entry.path });
      if (!result.success) throw new Error(result.error);
      setSelectedFile(result.data.file);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'Không thể đọc tệp.');
    } finally {
      setLoading(false);
    }
  };

  const goUp = () => {
    if (directory === '.') return;
    const segments = directory.split('/').filter(Boolean);
    segments.pop();
    setSelectedFile(null);
    void loadDirectory(segments.join('/') || '.');
  };

  return { directory, entries, selectedFile, loading, error, loadDirectory, openEntry, goUp };
}
