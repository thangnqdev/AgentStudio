import { useCallback, useEffect, useRef, useState, type WheelEvent } from 'react';

type ScrollState = { hasOverflow: boolean; canScrollBack: boolean; canScrollForward: boolean };

const INITIAL_SCROLL_STATE: ScrollState = { hasOverflow: false, canScrollBack: false, canScrollForward: false };

export function useHorizontalTabList(activeTabId: string | null) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState(INITIAL_SCROLL_STATE);

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    setScrollState({
      hasOverflow: maxScroll > 1,
      canScrollBack: viewport.scrollLeft > 1,
      canScrollForward: viewport.scrollLeft < maxScroll - 1,
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(viewport);
    const content = viewport.firstElementChild;
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [updateScrollState]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !activeTabId) return;
    const activeTab = [...viewport.querySelectorAll<HTMLElement>('[data-tab-id]')]
      .find((element) => element.dataset.tabId === activeTabId);
    activeTab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    const frame = window.requestAnimationFrame(updateScrollState);
    return () => window.cancelAnimationFrame(frame);
  }, [activeTabId, updateScrollState]);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({ left: direction * Math.max(120, viewport.clientWidth * 0.7), behavior: 'smooth' });
  }, []);

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || viewport.scrollWidth <= viewport.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    event.preventDefault();
    viewport.scrollLeft += event.deltaY;
  }, []);

  return { viewportRef, ...scrollState, updateScrollState, scrollByPage, handleWheel };
}
