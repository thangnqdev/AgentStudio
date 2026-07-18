import { useState } from 'react';
import { buildManualCompactionMessages, isManualCompactionSnapshotCurrent, projectManualCompactionMessages } from '../services/manualCompactionState';
import { ManualCompactionBridge } from '../../infrastructure/ipc/manualCompactionBridge';
import { useAppStore } from '../../store/useAppStore';

export function useManualCompaction() {
  const replaceMessages = useAppStore((state) => state.replaceMessages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const compact = async (instructions: string) => {
    const snapshot = useAppStore.getState();
    if (snapshot.messages.some((message) => message.status === 'sending')) return false;
    setBusy(true); setError('');
    try {
      const result = await ManualCompactionBridge.compact({
        messages: projectManualCompactionMessages(snapshot.messages),
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        ...(snapshot.activeThreadId ? { scopeId: snapshot.activeThreadId } : {}),
      });
      if (!result.success) throw new Error(result.error);
      if (!result.data.compacted || !result.data.summary) throw new Error('Chưa đủ lịch sử để compact.');
      const current = useAppStore.getState();
      if (!isManualCompactionSnapshotCurrent(snapshot, current)) {
        throw new Error('Hội thoại đã thay đổi trong lúc compact; hãy thử lại.');
      }
      const compactedMessages = buildManualCompactionMessages(current.messages, result.data, {
        createId: () => `manual-compaction-${crypto.randomUUID()}`,
        now: () => new Date(),
      });
      if (!compactedMessages) throw new Error('Chưa đủ lịch sử để compact.');
      replaceMessages(compactedMessages);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể compact hội thoại.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { compact, busy, error };
}
