import type { WebFetchInput } from '../../domain/entities/webFetch.js';
import { normalizeWebFetchUrl } from '../../domain/entities/webFetch.js';

export function parseWebFetchInput(args: Record<string, unknown>): WebFetchInput {
  if (typeof args.url !== 'string' || typeof args.prompt !== 'string') {
    throw new Error('WebFetch requires string properties "url" and "prompt".');
  }
  return { url: normalizeWebFetchUrl(args.url), prompt: args.prompt };
}

export function formatCrossHostRedirect(input: {
  originalUrl: string;
  redirectUrl: string;
  code: number;
  codeText: string;
  prompt: string;
}) {
  return [
    'REDIRECT DETECTED: The URL redirects to a different host.',
    '',
    `Original URL: ${input.originalUrl}`,
    `Redirect URL: ${input.redirectUrl}`,
    `Status: ${input.code} ${input.codeText}`,
    '',
    'To complete the request, call WebFetch again with the redirect URL and the same prompt.',
  ].join('\n');
}
