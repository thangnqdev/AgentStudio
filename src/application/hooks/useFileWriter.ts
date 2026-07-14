import { useState } from 'react';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';

/**
 * Hook adapter cho thao tác ghi file workspace từ UI.
 * Tách component ra khỏi AgentBridge trực tiếp.
 */
export function useFileWriter() {
  const [isWriting, setIsWriting] = useState(false);

  const writeWorkspaceFile = async (relativePath: string, content: string): Promise<void> => {
    if (!AgentBridge.isAvailable) throw new Error('Electron bridge is not available.');
    setIsWriting(true);
    try {
      const result = await AgentBridge.writeWorkspaceFile({ path: relativePath, content });
      if ('error' in result) throw new Error(result.error || 'Lỗi không xác định.');
    } finally {
      setIsWriting(false);
    }
  };

  return { isWriting, writeWorkspaceFile };
}
