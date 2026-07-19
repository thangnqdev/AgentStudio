export interface IWorkspaceRootSource {
  getWorkspaceRoot(): Promise<string>;
}
