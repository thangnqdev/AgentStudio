import { formatPostgresSchemaDocument } from './postgresSchemaDocument.js';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'to', 'with',
  'cua', 'cac', 'cho', 'duoc', 'la', 'nhung', 'theo', 'trong', 'va', 'voi', 'mot', 'nhu', 'nay', 'do', 'tu', 'khi', 'can', 've',
]);

export function foldKnowledgeText(value: string) {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

export function tokenizeKnowledgeText(value: string) {
  return foldKnowledgeText(value).split(/[^a-z0-9_]+/).filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

export function normalizeKnowledgeText(value: string) {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function formatKnowledgeDocument(extension: string, text: string) {
  const normalizedExtension = extension.toLowerCase();
  if (normalizedExtension === '.sql') return formatPostgresSchemaDocument(text);
  if (normalizedExtension === '.html' || normalizedExtension === '.htm') {
    return text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, '\n').replace(/<[^>]+>/g, ' ');
  }
  if (normalizedExtension === '.json') {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return normalizedExtension === '.csv' ? text.replace(/,/g, ' | ') : text;
}
