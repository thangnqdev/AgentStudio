import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectInstructionDocument } from '../../domain/entities/projectInstruction.js';
import type { IProjectInstructionLoader } from '../../domain/ports/IProjectInstructionLoader.js';
import { resolveSafeWorkspacePath } from '../security/resolveSafePath.js';

const MAX_INSTRUCTION_FILE_BYTES = 64_000;
const MAX_TOTAL_INSTRUCTION_BYTES = 160_000;
const INSTRUCTION_PATHS = [
  'AGENTS.md',
  'CLAUDE.md',
  '.claude/CLAUDE.md',
  '.claude/CLAUDE.local.md',
];

export class FileSystemProjectInstructionLoader implements IProjectInstructionLoader {
  async load(workspaceRoot: string): Promise<ProjectInstructionDocument[]> {
    const documents: ProjectInstructionDocument[] = [];
    let totalBytes = 0;

    for (const source of INSTRUCTION_PATHS) {
      const document = await readInstruction(workspaceRoot, source);
      if (!document) continue;
      const bytes = Buffer.byteLength(document.content, 'utf8');
      if (totalBytes + bytes > MAX_TOTAL_INSTRUCTION_BYTES) break;
      totalBytes += bytes;
      documents.push(document);
    }
    return documents;
  }
}

async function readInstruction(workspaceRoot: string, source: string) {
  let filePath: string;
  try {
    filePath = await resolveSafeWorkspacePath(source, workspaceRoot);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }

  const handle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_INSTRUCTION_FILE_BYTES) return null;
    const content = await handle.readFile({ encoding: 'utf8' });
    if (!content.trim() || Buffer.byteLength(content, 'utf8') > MAX_INSTRUCTION_FILE_BYTES) return null;
    return { source: source.split(path.sep).join('/'), content } satisfies ProjectInstructionDocument;
  } finally {
    await handle.close();
  }
}

function isMissing(error: unknown) {
  return error instanceof Error && (
    'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    || error.message.includes('does not exist')
  );
}
