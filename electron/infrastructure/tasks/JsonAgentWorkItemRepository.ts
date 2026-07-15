import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createEmptyAgentWorkItemBoard, parseAgentWorkItemBoard, type AgentWorkItemBoard } from '../../domain/entities/agentWorkItem.js';
import type { IAgentWorkItemRepository } from '../../domain/ports/IAgentWorkItemRepository.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';

const MAX_STORE_BYTES = 1024 * 1024;

export class JsonAgentWorkItemRepository implements IAgentWorkItemRepository {
  private readonly directory: string | (() => string);

  constructor(options: { directory: string | (() => string) }) {
    this.directory = options.directory;
  }

  async load(taskListId: string) {
    const target = this.targetPath(taskListId);
    let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
    try {
      handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_STORE_BYTES) throw new Error('Agent work-item store is invalid or too large.');
      const content = await handle.readFile({ encoding: 'utf8' });
      if (Buffer.byteLength(content, 'utf8') > MAX_STORE_BYTES) throw new Error('Agent work-item store is too large.');
      return parseAgentWorkItemBoard(JSON.parse(content));
    } catch (error) {
      if (isMissing(error)) return createEmptyAgentWorkItemBoard();
      if (error instanceof SyntaxError) throw new Error('Agent work-item store contains invalid JSON.');
      throw error;
    } finally {
      await handle?.close();
    }
  }

  async save(taskListId: string, board: AgentWorkItemBoard) {
    const validated = parseAgentWorkItemBoard(board);
    const serialized = `${JSON.stringify(validated, null, 2)}\n`;
    if (Buffer.byteLength(serialized, 'utf8') > MAX_STORE_BYTES) throw new Error('Agent work-item store is too large.');
    await writePrivateFileAtomic(this.targetPath(taskListId), serialized);
  }

  async delete(taskListId: string) {
    await fs.rm(this.targetPath(taskListId), { force: true });
  }

  private targetPath(taskListId: string) {
    if (!taskListId || taskListId.length > 256 || taskListId.includes('\0')) throw new Error('Task list ID is invalid.');
    const digest = createHash('sha256').update(taskListId).digest('hex');
    const directory = typeof this.directory === 'function' ? this.directory() : this.directory;
    if (!directory) throw new Error('Agent work-item directory is unavailable.');
    return path.join(directory, `${digest}.json`);
  }
}

function isMissing(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
