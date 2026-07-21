import { useCallback, useState, type PointerEvent } from 'react';

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 520;

export function useSidebarResize(width: number, onResize: (width: number) => void) {
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    setIsResizing(true);

    const move = (e: globalThis.PointerEvent) => {
      const next = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + e.clientX - startX));
      onResize(next);
    };
    const stop = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }, [onResize, width]);

  return { resize: startResize, isResizing };
}
