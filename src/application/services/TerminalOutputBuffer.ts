export class TerminalOutputBuffer {
  private readonly pending = new Map<string, string[]>();

  accept(payload: { terminalId: string; data?: string }, activeTerminalId: string | null) {
    if (!payload.data) return null;
    if (payload.terminalId === activeTerminalId) return payload.data;
    if (!activeTerminalId) this.pending.set(payload.terminalId, [
      ...(this.pending.get(payload.terminalId) ?? []), payload.data,
    ]);
    return null;
  }

  drain(terminalId: string) {
    const data = this.pending.get(terminalId) ?? [];
    this.pending.clear();
    return data;
  }
}
