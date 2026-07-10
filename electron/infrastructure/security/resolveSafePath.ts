import path from 'node:path';

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
  const relative = path.relative(rootPath, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
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
