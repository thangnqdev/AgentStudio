import type { ProjectInstructionDocument } from '../entities/projectInstruction.js';

export interface IProjectInstructionLoader {
  load(workspaceRoot: string): Promise<ProjectInstructionDocument[]>;
}
