import fs from 'node:fs/promises';
import path from 'node:path';
import { isInsidePath } from '../security/resolveSafePath.js';

const MAX_FILES = 500;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

export class ManagedPackageDirectory {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async install(sourcePath: string, packageName: string) {
    const source = await fs.realpath(sourcePath);
    const sourceStat = await fs.stat(source);
    if (!sourceStat.isDirectory()) throw new Error('Nguồn cài đặt phải là một thư mục.');
    await fs.mkdir(this.root, { recursive: true });
    const target = path.resolve(this.root, packageName);
    assertDirectChild(target, this.root);
    if (await exists(target)) throw new Error(`Đã tồn tại gói ${packageName}.`);
    const entries = await collectFiles(source);
    try {
      await fs.mkdir(target, { recursive: false });
      for (const entry of entries) {
        const destination = path.resolve(target, entry.relativePath);
        if (!isInsidePath(destination, target)) throw new Error('Đường dẫn gói không an toàn.');
        if (entry.kind === 'directory') await fs.mkdir(destination, { recursive: true });
        else {
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.copyFile(entry.sourcePath, destination);
        }
      }
    } catch (error) {
      if (isInsidePath(target, this.root)) await fs.rm(target, { recursive: true, force: true });
      throw error;
    }
  }

  async remove(targetPath: string) {
    const root = await fs.realpath(this.root);
    const target = await fs.realpath(targetPath);
    assertDirectChild(target, root);
    await fs.rm(target, { recursive: true, force: false });
  }

  async owns(targetPath: string) {
    try {
      const root = await fs.realpath(this.root);
      const target = await fs.realpath(targetPath);
      return isDirectChild(target, root);
    } catch {
      return false;
    }
  }
}

type CopyEntry = { kind: 'directory' | 'file'; sourcePath: string; relativePath: string };

async function collectFiles(sourceRoot: string): Promise<CopyEntry[]> {
  const collected: CopyEntry[] = [];
  const queue = [''];
  let totalBytes = 0;
  while (queue.length > 0) {
    const relativeRoot = queue.shift() ?? '';
    const entries = await fs.readdir(path.resolve(sourceRoot, relativeRoot), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error('Skill/plugin chứa symbolic link nên không thể nhập an toàn.');
      const relativePath = path.join(relativeRoot, entry.name);
      const sourcePath = path.resolve(sourceRoot, relativePath);
      if (!isInsidePath(sourcePath, sourceRoot)) throw new Error('Đường dẫn gói thoát khỏi thư mục nguồn.');
      if (entry.isDirectory()) {
        collected.push({ kind: 'directory', sourcePath, relativePath });
        queue.push(relativePath);
      } else if (entry.isFile()) {
        totalBytes += (await fs.stat(sourcePath)).size;
        collected.push({ kind: 'file', sourcePath, relativePath });
      }
      if (collected.length > MAX_FILES || totalBytes > MAX_TOTAL_BYTES) throw new Error('Gói vượt giới hạn nhập an toàn.');
    }
  }
  return collected;
}

function assertDirectChild(target: string, root: string) {
  if (!isDirectChild(target, path.resolve(root))) throw new Error('Đường dẫn gói không thuộc vùng ứng dụng quản lý.');
}

function isDirectChild(target: string, root: string) {
  return path.dirname(path.resolve(target)) === path.resolve(root);
}

async function exists(target: string) {
  try { await fs.access(target); return true; } catch { return false; }
}
