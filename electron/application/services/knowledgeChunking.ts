import { randomUUID } from 'node:crypto';
import type { KnowledgeChunk } from '../../domain/entities/knowledge.js';

const MAX_CHUNK_CHARS = 3_200;
const CHUNK_OVERLAP_CHARS = 360;

export function chunkKnowledgeDocument(content: string, sourceName: string, documentId: string): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  let ordinal = 1;
  for (const section of splitSections(content)) {
    const header = `[Source: ${sourceName} | Section: ${section.title}]`;
    for (const part of splitSectionContent(section.content)) {
      const contextualContent = `${header}\n${part}`;
      chunks.push({
        id: randomUUID(),
        documentId,
        ordinal: ordinal++,
        content: contextualContent,
        section: section.title,
        tokenCount: Math.ceil(contextualContent.length / 4),
      });
    }
  }
  return chunks;
}

function splitSections(content: string) {
  const sections: Array<{ title: string; content: string }> = [];
  let title = 'Nội dung';
  let body: string[] = [];
  const flush = () => {
    const sectionContent = body.join('\n').trim();
    if (sectionContent) sections.push({ title, content: sectionContent });
    body = [];
  };

  for (const line of content.split('\n')) {
    if (/^(#{1,6}\s+.+|[A-Z][^\n]{2,80}:)$/.test(line.trim())) {
      flush();
      title = line.replace(/^#+\s*/, '').replace(/:$/, '').trim();
    } else {
      body.push(line);
    }
  }
  flush();
  return sections.length > 0 ? sections : [{ title: 'Nội dung', content }];
}

function splitSectionContent(content: string) {
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of content.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean)) {
    for (const unit of paragraph.length > MAX_CHUNK_CHARS ? splitLongText(paragraph) : [paragraph]) {
      const next = current ? `${current}\n\n${unit}` : unit;
      if (next.length <= MAX_CHUNK_CHARS) {
        current = next;
        continue;
      }
      if (current) chunks.push(current);
      current = current ? `${current.slice(-CHUNK_OVERLAP_CHARS)}\n\n${unit}` : unit;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitLongText(text: string) {
  const pieces: string[] = [];
  let current = '';
  for (const sentence of text.match(/[^.!?\n]+[.!?]?/g) ?? [text]) {
    if ((current ? `${current} ${sentence}` : sentence).length <= MAX_CHUNK_CHARS) {
      current = current ? `${current} ${sentence}` : sentence;
      continue;
    }
    if (current) pieces.push(current);
    let remainder = sentence;
    let overlap = current.slice(-CHUNK_OVERLAP_CHARS);
    while (remainder.length > MAX_CHUNK_CHARS - overlap.length - 1) {
      const size = MAX_CHUNK_CHARS - overlap.length - 1;
      current = `${overlap} ${remainder.slice(0, size)}`.trim();
      pieces.push(current);
      remainder = remainder.slice(size).trim();
      overlap = current.slice(-CHUNK_OVERLAP_CHARS);
    }
    current = `${overlap} ${remainder}`.trim();
  }
  if (current) pieces.push(current);
  return pieces;
}
