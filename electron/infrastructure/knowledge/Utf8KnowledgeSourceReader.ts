import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { KnowledgeSourceDocument } from '../../domain/entities/knowledge.js';
import type { IKnowledgeSourceReader } from '../../domain/ports/IKnowledgeSourceReader.js';
import { formatKnowledgeDocument, normalizeKnowledgeText } from '../../application/services/knowledgeText.js';

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export class Utf8KnowledgeSourceReader implements IKnowledgeSourceReader {
  async read(sourcePath: string): Promise<KnowledgeSourceDocument> {
    const resolvedPath = path.resolve(sourcePath);
    const stat = await fs.stat(resolvedPath);
    if (!stat.isFile()) throw new Error('Đường dẫn không phải là tệp.');
    if (stat.size > MAX_DOCUMENT_BYTES) throw new Error(`${path.basename(resolvedPath)} vượt giới hạn 5 MB.`);

    const buffer = await fs.readFile(resolvedPath);
    if (buffer.includes(0)) throw new Error(`${path.basename(resolvedPath)} không phải tài liệu văn bản UTF-8.`);
    const content = normalizeKnowledgeText(formatKnowledgeDocument(path.extname(resolvedPath), buffer.toString('utf8')));
    if (content.length < 20) throw new Error(`${path.basename(resolvedPath)} không có đủ nội dung văn bản.`);
    return {
      name: path.basename(resolvedPath),
      sourcePath: resolvedPath,
      content,
      size: stat.size,
      contentHash: createHash('sha256').update(content).digest('hex'),
    };
  }
}
