export const PDF_MAX_PAGES_PER_READ = 20;
export const PDF_MAX_INLINE_PAGES = 10;

export type PdfPageRange = { firstPage: number; lastPage: number };

export function parsePdfPageRange(value: string): PdfPageRange | null {
  const match = /^([1-9]\d*)(?:-([1-9]\d*))?$/.exec(value.trim());
  if (!match) return null;
  const firstPage = Number(match[1]);
  const lastPage = Number(match[2] ?? match[1]);
  if (!Number.isSafeInteger(firstPage) || !Number.isSafeInteger(lastPage) || lastPage < firstPage) return null;
  if (lastPage - firstPage + 1 > PDF_MAX_PAGES_PER_READ) return null;
  return { firstPage, lastPage };
}
