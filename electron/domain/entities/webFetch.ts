import type { AgentToolDefinition } from './tool.js';

export const WEB_FETCH_TOOL_NAME = 'WebFetch';
export const WEB_FETCH_MAX_URL_LENGTH = 2_000;
export const WEB_FETCH_MAX_CONTENT_BYTES = 10 * 1024 * 1024;
export const WEB_FETCH_TIMEOUT_MS = 60_000;
export const WEB_FETCH_MAX_REDIRECTS = 10;
export const WEB_FETCH_MAX_MARKDOWN_LENGTH = 100_000;
export const WEB_FETCH_MAX_RESULT_LENGTH = 100_000;

export const WEB_FETCH_TOOL_DEFINITION: AgentToolDefinition = {
  name: WEB_FETCH_TOOL_NAME,
  description: [
    'IMPORTANT: WebFetch cannot access authenticated or private URLs. Prefer a specialized MCP tool when authenticated access is required.',
    'Fetch a fully formed public URL, convert HTML to Markdown, and apply a prompt to the fetched content.',
    'HTTP URLs are upgraded to HTTPS. Cross-host redirects are reported and must be fetched with a separate WebFetch call.',
    'This tool is read-only, bounded to 10 MB, and uses a self-cleaning 15-minute network cache.',
  ].join('\n'),
  risk: 'network',
  readOnly: true,
  concurrencySafe: true,
  deferLoading: true,
  searchHint: 'fetch and extract content from a URL',
  parameters: {
    additionalProperties: false,
    properties: {
      url: { type: 'string', description: 'The fully formed public URL to fetch.' },
      prompt: { type: 'string', description: 'What information to extract from the fetched content.' },
    },
    required: ['url', 'prompt'],
  },
};

export type WebFetchInput = { url: string; prompt: string };

export type WebFetchResponse = {
  bytes: number;
  code: number;
  codeText: string;
  result: string;
  durationMs: number;
  url: string;
};

export type WebPageFetchResult =
  | {
    type: 'content';
    url: string;
    code: number;
    codeText: string;
    contentType: string;
    body: Uint8Array;
  }
  | {
    type: 'redirect';
    originalUrl: string;
    redirectUrl: string;
    code: number;
    codeText: string;
  };

export function normalizeWebFetchUrl(rawUrl: string) {
  const value = rawUrl.trim();
  if (!value || value.length > WEB_FETCH_MAX_URL_LENGTH) throw new Error('Invalid URL.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('WebFetch only supports HTTP and HTTPS URLs.');
  if (url.username || url.password) throw new Error('WebFetch does not allow credentials in URLs.');
  if (!looksPublic(url.hostname)) throw new Error('WebFetch requires a public hostname.');
  if (url.protocol === 'http:') url.protocol = 'https:';
  return url.toString();
}

export function isPermittedWebFetchRedirect(originalUrl: string, redirectUrl: string) {
  try {
    const original = new URL(originalUrl);
    const redirect = new URL(redirectUrl);
    if (original.protocol !== redirect.protocol || original.port !== redirect.port) return false;
    if (redirect.username || redirect.password) return false;
    return stripWww(original.hostname) === stripWww(redirect.hostname);
  } catch {
    return false;
  }
}

export function isBinaryWebContent(contentType: string) {
  const mime = contentType.split(';', 1)[0].trim().toLowerCase();
  if (!mime || mime.startsWith('text/')) return false;
  if (mime === 'application/json' || mime.endsWith('+json')) return false;
  if (mime === 'application/xml' || mime.endsWith('+xml')) return false;
  if (mime.startsWith('application/javascript')) return false;
  if (mime === 'application/yaml' || mime === 'application/x-yaml') return false;
  return mime !== 'application/x-www-form-urlencoded';
}

function looksPublic(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, '');
  return normalized.includes('.') && !normalized.startsWith('.') && !normalized.endsWith('.');
}

function stripWww(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, '');
}
