export type CommandPrefixMatch = 'matched' | 'unmatched' | 'ambiguous';

export function normalizePermissionPath(value: string) {
  const portable = value.replaceAll('\\', '/');
  const drive = /^[a-z]:/i.exec(portable)?.[0] ?? '';
  const absolute = portable.startsWith('/') || Boolean(drive);
  const body = drive ? portable.slice(drive.length) : portable;
  const segments: string[] = [];
  for (const segment of body.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length && segments.at(-1) !== '..') segments.pop();
      else if (!absolute) segments.push(segment);
    } else {
      segments.push(segment);
    }
  }
  const prefix = drive ? `${drive.toLowerCase()}/` : absolute ? '/' : '';
  return `${prefix}${segments.join('/')}` || (absolute ? prefix : '.');
}

export function matchCommandPrefix(command: string, rawPrefix: string): CommandPrefixMatch {
  const prefix = normalizeWhitespace(rawPrefix);
  if (!prefix) return 'unmatched';
  const parsed = splitShellSegments(command);
  if (!parsed.ok) return 'ambiguous';

  let ambiguous = false;
  for (const segment of parsed.segments) {
    if (hasNestedExecution(segment)) {
      ambiguous = true;
      continue;
    }
    const candidate = canonicalCommandSegment(segment);
    if (candidate === null) {
      ambiguous = true;
      continue;
    }
    if (hasCommandPrefix(candidate, prefix)) return 'matched';
  }
  return ambiguous ? 'ambiguous' : 'unmatched';
}

function splitShellSegments(command: string): { ok: boolean; segments: string[] } {
  const segments: string[] = [];
  let current = '';
  let quote: "'" | '"' | '' = '';
  let escaped = false;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (escaped) { current += character; escaped = false; continue; }
    if (character === '\\' && quote !== "'") { current += character; escaped = true; continue; }
    if ((character === "'" || character === '"')) {
      if (!quote) quote = character;
      else if (quote === character) quote = '';
      current += character;
      continue;
    }
    if (!quote) {
      const pair = command.slice(index, index + 2);
      if (pair === '&&' || pair === '||') {
        pushSegment(segments, current); current = ''; index += 1; continue;
      }
      if (character === ';' || character === '|' || character === '\n') {
        pushSegment(segments, current); current = ''; continue;
      }
      if (character === '&' || character === '(' || character === ')') return { ok: false, segments };
    }
    current += character;
  }
  if (escaped || quote) return { ok: false, segments };
  pushSegment(segments, current);
  return { ok: true, segments };
}

function canonicalCommandSegment(segment: string): string | null {
  let current = segment.trim();
  while (current) {
    const match = /^([^\s]+)(?:\s+|$)/.exec(current);
    if (!match || !/^[a-zA-Z0-9_./:-]+$/.test(match[1])) return null;
    const word = match[1];
    const rest = current.slice(match[0].length);
    if (/^[a-zA-Z_][a-zA-Z0-9_]*=/.test(word) || ['command', 'exec', 'nohup', 'env'].includes(word)) {
      current = rest.trimStart();
      continue;
    }
    if (['sudo', 'sh', 'bash', 'zsh', 'fish', 'cmd', 'cmd.exe', 'powershell', 'pwsh', 'eval'].includes(executableName(word))) return null;
    const executable = executableName(word);
    return normalizeWhitespace(`${executable}${rest ? ` ${rest}` : ''}`);
  }
  return '';
}

function executableName(value: string) {
  return value.replaceAll('\\', '/').split('/').at(-1)?.toLowerCase() ?? '';
}

function hasNestedExecution(value: string) {
  return value.includes('`') || value.includes('$(') || value.includes('<(') || value.includes('>(');
}

function hasCommandPrefix(command: string, prefix: string) {
  return command === prefix || command.startsWith(`${prefix} `);
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function pushSegment(segments: string[], value: string) {
  const normalized = value.trim();
  if (normalized) segments.push(normalized);
}
