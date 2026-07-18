import type { ToolResult } from '../entities/agent.js';

export interface IFileMediaReader {
  supports(filePath: string): boolean;
  read(filePath: string, pages?: string, signal?: AbortSignal): Promise<ToolResult>;
}
