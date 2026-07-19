export type WorkspaceFileEntry = {
  name: string;
  path: string;
  kind: 'directory' | 'file';
  size?: number;
};

export type WorkspaceFileContent = {
  path: string;
  content: string;
};
