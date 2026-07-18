import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalFileMediaReader } from './LocalFileMediaReader.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));

async function workspace() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-media-test-'));
  directories.push(directory);
  return directory;
}

describe('LocalFileMediaReader', () => {
  it('returns a validated image as a model-facing image_url without putting base64 in output', async () => {
    const directory = await workspace();
    const file = path.join(directory, 'pixel.png');
    await fs.writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]));
    const result = await new LocalFileMediaReader(undefined, directory).read(file);
    expect(result).toMatchObject({ ok: true, output: expect.not.stringContaining('iVBOR'), supplementalMessages: [{ role: 'user' }] });
    expect(JSON.stringify(result.supplementalMessages)).toContain('data:image/png;base64,');
  });

  it('renders a bounded PDF range through argument-array process calls', async () => {
    const directory = await workspace();
    const file = path.join(directory, 'manual.pdf');
    await fs.writeFile(file, '%PDF-1.7\nfixture');
    const run = vi.fn(async (command: string, args: string[]) => {
      if (command === 'pdfinfo') return { ok: true, output: 'Pages:          3\nExit code: 0' };
      const prefix = args.at(-1)!;
      await Promise.all([1, 2].map((page) => fs.writeFile(`${prefix}-${page}.jpg`, Buffer.from([0xff, 0xd8, 0xff, page]))));
      return { ok: true, output: 'Exit code: 0' };
    });
    const result = await new LocalFileMediaReader(run, directory).read(file, '2-3');
    expect(run).toHaveBeenCalledWith('pdftoppm', expect.arrayContaining(['-f', '2', '-l', '3', file]), directory, 120_000, 5_000, undefined);
    expect(result).toMatchObject({ ok: true, output: expect.stringContaining('2 page(s)'), supplementalMessages: [{ role: 'user' }] });
    expect(JSON.stringify(result.supplementalMessages).match(/data:image\/jpeg/g)).toHaveLength(2);
  });

  it('requires a range for PDFs over ten pages and rejects invalid ranges before rendering', async () => {
    const directory = await workspace();
    const file = path.join(directory, 'manual.pdf');
    await fs.writeFile(file, '%PDF-1.7\nfixture');
    const run = vi.fn(async () => ({ ok: true, output: 'Pages: 11\nExit code: 0' }));
    await expect(new LocalFileMediaReader(run, directory).read(file)).resolves.toEqual({ ok: false, output: expect.stringContaining('11 pages') });
    run.mockClear();
    await expect(new LocalFileMediaReader(run, directory).read(file, '1-21')).resolves.toEqual({ ok: false, output: expect.stringContaining('Invalid pages') });
    expect(run).not.toHaveBeenCalled();
  });
});
