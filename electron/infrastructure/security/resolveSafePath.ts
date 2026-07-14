import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Xử lý đường dẫn để chống path-traversal (directory traversal).
 * Ngăn chặn agent hoặc user request sử dụng `../` hoặc đường dẫn tuyệt đối
 * để truy cập các file nằm ngoài thư mục gốc (workspace).
 *
 * @param candidatePath Đường dẫn tương đối muốn truy cập
 * @param rootPath Thư mục gốc bắt buộc (workspace)
 * @returns Đường dẫn tuyệt đối an toàn đã được resolve
 * @throws {Error} Nếu candidatePath cố tình thoát khỏi rootPath
 */
export function resolveSafePath(candidatePath: string, rootPath: string): string {
  if (!candidatePath) {
    throw new Error('Path is required.');
  }

  const resolved = path.resolve(path.join(rootPath, candidatePath));
  if (!isInsidePath(resolved, rootPath)) {
    throw new Error(`Path escapes workspace: ${candidatePath}`);
  }

  return resolved;
}

/**
 * Kiểm tra xem một path tuyệt đối (đã được resolve) có nằm trong root hay không.
 * Phù hợp khi đường dẫn đã được resolve tuyệt đối từ trước.
 *
 * @param resolvedPath Đường dẫn tuyệt đối đã được resolve
 * @param rootPath Thư mục gốc (workspace)
 * @returns true nếu an toàn, false nếu thoát ra ngoài
 */
export function isInsidePath(resolvedPath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, resolvedPath);
  return relative === '' || (Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Resolves an agent-controlled workspace path without following symbolic links.
 * `path.resolve` alone is not sufficient: a symlink nested under the workspace
 * can otherwise point to an arbitrary host path.
 */
export async function resolveSafeWorkspacePath(
  candidatePath: string,
  workspaceRoot: string,
  options: { allowMissingFinalPath?: boolean } = {},
): Promise<string> {
  if (!candidatePath) throw new Error('Path is required.');

  const realRoot = await fs.realpath(workspaceRoot);
  const resolved = path.resolve(realRoot, candidatePath);
  if (!isInsidePath(resolved, realRoot)) throw new Error(`Path escapes workspace: ${candidatePath}`);

  const segments = path.relative(realRoot, resolved).split(path.sep).filter(Boolean);
  let current = realRoot;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in workspace paths: ${candidatePath}`);
      if (index < segments.length - 1 && !stat.isDirectory()) throw new Error(`Path parent is not a directory: ${candidatePath}`);
    } catch (error) {
      if (isMissingPath(error) && options.allowMissingFinalPath) return resolved;
      throw error;
    }
  }

  return resolved;
}

function isMissingPath(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
