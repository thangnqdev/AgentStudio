const DEFAULT_TTL_MS = 15 * 60 * 1_000;
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

export type PreparedWebContent = {
  bytes: number;
  code: number;
  codeText: string;
  content: string;
  contentType: string;
  persisted?: { path: string; size: number };
};

type Entry = { value: PreparedWebContent; expiresAt: number; size: number };

export class WebPreparedContentCache {
  private readonly entries = new Map<string, Entry>();
  private readonly ttlMs: number;
  private readonly maxBytes: number;
  private readonly now: () => number;
  private totalBytes = 0;

  constructor(
    ttlMs = DEFAULT_TTL_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    now: () => number = Date.now,
  ) {
    this.ttlMs = ttlMs;
    this.maxBytes = maxBytes;
    this.now = now;
  }

  get(url: string) {
    const entry = this.entries.get(url);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) { this.delete(url, entry); return undefined; }
    this.entries.delete(url); this.entries.set(url, entry);
    return entry.value;
  }

  set(url: string, value: PreparedWebContent) {
    const size = Math.max(1, new TextEncoder().encode(value.content).byteLength);
    if (size > this.maxBytes) return;
    const previous = this.entries.get(url);
    if (previous) this.delete(url, previous);
    this.entries.set(url, { value, size, expiresAt: this.now() + this.ttlMs });
    this.totalBytes += size;
    while (this.totalBytes > this.maxBytes) {
      const oldest = this.entries.entries().next().value as [string, Entry] | undefined;
      if (!oldest) break;
      this.delete(oldest[0], oldest[1]);
    }
  }

  clear() { this.entries.clear(); this.totalBytes = 0; }

  private delete(url: string, entry: Entry) {
    this.entries.delete(url); this.totalBytes -= entry.size;
  }
}
