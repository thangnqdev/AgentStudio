export const DEFAULT_SIDEBAR_WIDTH = 264;

export function clampSidebarWidth(width: number) {
  return Math.min(420, Math.max(220, Math.round(width)));
}
