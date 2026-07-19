import { useCallback, type PointerEvent } from 'react';

export function useUtilityDockResize(width: number, onResize: (width: number) => void) {
  return useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const move = (pointerEvent: globalThis.PointerEvent) => {
      onResize(startWidth + startX - pointerEvent.clientX);
    };
    const stop = () => {
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
}
