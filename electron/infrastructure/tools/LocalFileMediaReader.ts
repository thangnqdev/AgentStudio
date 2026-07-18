import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ToolResult } from '../../domain/entities/agent.js';
import { MAX_IMAGE_BYTES } from '../../domain/entities/limits.js';
import {
  PDF_MAX_INLINE_PAGES,
  parsePdfPageRange,
} from '../../domain/entities/pdfPageRange.js';
import type { IFileMediaReader } from '../../domain/ports/IFileMediaReader.js';
import { spawnAndCollect } from './sandbox/SandboxedCommandExecutor.js';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const MAX_PDF_INPUT_BYTES = 100 * 1024 * 1024;
const MAX_RENDERED_PDF_BYTES = 8 * 1024 * 1024;

type ProcessRunner = (
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  gracePeriodMs?: number,
  signal?: AbortSignal,
) => Promise<ToolResult>;

export class LocalFileMediaReader implements IFileMediaReader {
  private readonly runProcess: ProcessRunner;
  private readonly temporaryRoot: string;

  constructor(runProcess: ProcessRunner = spawnAndCollect, temporaryRoot = os.tmpdir()) {
    this.runProcess = runProcess;
    this.temporaryRoot = temporaryRoot;
  }

  supports(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return extension === '.pdf' || IMAGE_EXTENSIONS.has(extension);
  }

  async read(filePath: string, pages?: string, signal?: AbortSignal): Promise<ToolResult> {
    if (signal?.aborted) return { ok: false, output: 'Media read cancelled.' };
    return path.extname(filePath).toLowerCase() === '.pdf'
      ? this.readPdf(filePath, pages, signal)
      : this.readImage(filePath);
  }

  private async readImage(filePath: string): Promise<ToolResult> {
    const stat = await fs.stat(filePath);
    if (stat.size === 0) return { ok: false, output: `Image file is empty: ${filePath}` };
    if (stat.size > MAX_IMAGE_BYTES) {
      return { ok: false, output: `Image is too large (${stat.size} bytes). Limit is ${MAX_IMAGE_BYTES} bytes.` };
    }
    const buffer = await fs.readFile(filePath);
    const mimeType = detectImageMimeType(buffer);
    if (!mimeType) return { ok: false, output: 'Image content does not match PNG, JPEG, GIF, or WebP.' };
    return {
      ok: true,
      output: `Image read: ${filePath} (${stat.size} bytes).`,
      supplementalMessages: [imageMessage(path.basename(filePath), mimeType, buffer.toString('base64'))],
    };
  }

  private async readPdf(filePath: string, pages: string | undefined, signal?: AbortSignal): Promise<ToolResult> {
    const stat = await fs.stat(filePath);
    if (stat.size === 0) return { ok: false, output: `PDF file is empty: ${filePath}` };
    if (stat.size > MAX_PDF_INPUT_BYTES) return { ok: false, output: 'PDF exceeds the 100 MB rendering limit.' };
    if (!await hasPdfHeader(filePath)) return { ok: false, output: 'File is not a valid PDF (missing %PDF- header).' };

    const range = pages ? parsePdfPageRange(pages) : undefined;
    if (pages && !range) {
      return { ok: false, output: `Invalid pages parameter: "${pages}". Use 1-indexed ranges of at most 20 pages, such as "1-5".` };
    }
    if (!range) {
      const pageCount = await this.getPdfPageCount(filePath, signal);
      if (pageCount === null) return { ok: false, output: 'Cannot determine PDF page count. Install poppler-utils or provide an explicit pages range.' };
      if (pageCount > PDF_MAX_INLINE_PAGES) {
        return { ok: false, output: `This PDF has ${pageCount} pages. Provide pages (for example "1-5"); maximum 20 pages per read.` };
      }
    }

    const directory = await fs.mkdtemp(path.join(this.temporaryRoot, 'agentstudio-pdf-'));
    try {
      const prefix = path.join(directory, 'page');
      const args = ['-jpeg', '-r', '100'];
      if (range) args.push('-f', String(range.firstPage), '-l', String(range.lastPage));
      args.push(filePath, prefix);
      const rendered = await this.runProcess('pdftoppm', args, path.dirname(filePath), 120_000, 5_000, signal);
      if (!rendered.ok) return { ok: false, output: describePdfRenderFailure(rendered.output) };
      const names = (await fs.readdir(directory)).filter((name) => name.endsWith('.jpg')).sort();
      if (!names.length) return { ok: false, output: 'pdftoppm produced no PDF page images.' };
      const paths = names.map((name) => path.join(directory, name));
      const sizes = await Promise.all(paths.map((pagePath) => fs.stat(pagePath).then((page) => page.size)));
      const totalBytes = sizes.reduce((total, size) => total + size, 0);
      if (totalBytes > MAX_RENDERED_PDF_BYTES) {
        return { ok: false, output: `Rendered PDF pages are too large (${totalBytes} bytes). Read a smaller page range.` };
      }
      const buffers = await Promise.all(paths.map((pagePath) => fs.readFile(pagePath)));
      const content: Array<Record<string, unknown>> = [{
        type: 'text', text: `Rendered ${buffers.length} page(s) from ${path.basename(filePath)}.`,
      }];
      buffers.forEach((buffer) => content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${buffer.toString('base64')}` },
      }));
      return {
        ok: true,
        output: `PDF pages read: ${filePath} (${buffers.length} page(s), ${stat.size} bytes).`,
        supplementalMessages: [{ role: 'user', content }],
      };
    } finally {
      await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async getPdfPageCount(filePath: string, signal?: AbortSignal): Promise<number | null> {
    const result = await this.runProcess('pdfinfo', [filePath], path.dirname(filePath), 10_000, 5_000, signal);
    if (!result.ok) return null;
    const match = /^Pages:\s+(\d+)/m.exec(result.output);
    const value = match ? Number(match[1]) : Number.NaN;
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
}

function imageMessage(name: string, mimeType: string, base64: string) {
  return {
    role: 'user' as const,
    content: [
      { type: 'text', text: `Image read from ${name}.` },
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
    ],
  };
}

async function hasPdfHeader(filePath: string) {
  const handle = await fs.open(filePath, 'r');
  try {
    const header = Buffer.alloc(5);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return bytesRead === 5 && header.toString('ascii') === '%PDF-';
  } finally {
    await handle.close();
  }
}

function detectImageMimeType(buffer: Buffer): string {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}

function describePdfRenderFailure(output: string) {
  if (/ENOENT|not found/i.test(output)) return 'pdftoppm is unavailable. Install poppler-utils to render PDF pages.';
  if (/password/i.test(output)) return 'PDF is password-protected. Provide an unprotected version.';
  if (/damaged|corrupt|invalid/i.test(output)) return 'PDF file is corrupted or invalid.';
  return `Could not render PDF pages: ${output.slice(0, 2_000)}`;
}
