export interface IWorkspaceIgnoreFilter {
  findIgnoredPaths(
    filePaths: string[],
    workspaceRoot: string,
    signal?: AbortSignal,
  ): Promise<ReadonlySet<string>>;
}
