import type { IWorkspaceFileChangeSink } from '../../domain/ports/IWorkspaceFileChangeSink.js';

export class CompositeWorkspaceFileChangeSink implements IWorkspaceFileChangeSink {
  private readonly sinks: readonly IWorkspaceFileChangeSink[];

  constructor(sinks: readonly IWorkspaceFileChangeSink[]) {
    this.sinks = sinks;
  }

  async fileChanged(filePath: string, workspaceRoot: string) {
    await Promise.allSettled(this.sinks.map((sink) => sink.fileChanged(filePath, workspaceRoot)));
  }
}
