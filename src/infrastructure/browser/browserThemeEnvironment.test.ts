import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserThemeEnvironment } from './browserThemeEnvironment';

afterEach(() => vi.unstubAllGlobals());

describe('BrowserThemeEnvironment', () => {
  it('reports and subscribes to system color scheme changes with cleanup', () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQuery = {
      matches: false,
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
      removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    } as unknown as MediaQueryList;
    vi.stubGlobal('window', { matchMedia: vi.fn(() => mediaQuery) });
    const listener = vi.fn();

    expect(BrowserThemeEnvironment.isSystemDark()).toBe(false);
    const cleanup = BrowserThemeEnvironment.subscribe(listener);
    listeners.forEach((notify) => notify({ matches: true } as MediaQueryListEvent));

    expect(listener).toHaveBeenCalledWith(true);
    cleanup();
    expect(listeners.size).toBe(0);
  });

  it('applies the resolved theme to the document root', () => {
    const documentElement = { dataset: {} as Record<string, string>, style: { colorScheme: '' } };
    vi.stubGlobal('document', { documentElement });

    BrowserThemeEnvironment.apply('dark');

    expect(documentElement.dataset.theme).toBe('dark');
    expect(documentElement.style.colorScheme).toBe('dark');
  });
});
