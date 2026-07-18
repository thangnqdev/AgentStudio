import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackgroundCommandNotice } from '../../domain/entities/backgroundCommand';
import { BackgroundCommandBridge } from '../../infrastructure/ipc/backgroundCommandBridge';

const NOTICE_LIFETIME_MS = 10_000;
const MAX_VISIBLE_NOTICES = 3;

export function useBackgroundCommandNotices() {
  const [notices, setNotices] = useState<BackgroundCommandNotice[]>([]);
  const timers = useRef(new Map<string, number>());
  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  useEffect(() => {
    const activeTimers = timers.current;
    const unsubscribe = BackgroundCommandBridge.subscribe((notice) => {
      setNotices((current) => [...current.filter((item) => item.id !== notice.id), notice].slice(-MAX_VISIBLE_NOTICES));
      const existing = activeTimers.get(notice.id);
      if (existing !== undefined) window.clearTimeout(existing);
      activeTimers.set(notice.id, window.setTimeout(() => dismiss(notice.id), NOTICE_LIFETIME_MS));
    });
    return () => {
      unsubscribe();
      for (const timer of activeTimers.values()) window.clearTimeout(timer);
      activeTimers.clear();
    };
  }, [dismiss]);

  return { notices, dismiss };
}
