export type McpResourceArtifact = { path: string; size: number };
export type McpTextArtifactRead = {
  content: string;
  offset: number;
  nextOffset?: number;
  totalCharacters: number;
};

export interface IMcpResourceArtifactStore {
  persistBase64(input: { base64: string; mimeType?: string }): Promise<McpResourceArtifact>;
  persistToolResult(input: { content: string }): Promise<McpResourceArtifact>;
  canReadTextArtifact(candidatePath: string): boolean;
  readTextArtifact(input: { path: string; offset: number; limit: number }): Promise<McpTextArtifactRead>;
}
