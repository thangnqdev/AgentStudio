export interface IWebBinaryStore {
  persist(input: { body: Uint8Array; contentType: string }): Promise<{ path: string; size: number }>;
}
