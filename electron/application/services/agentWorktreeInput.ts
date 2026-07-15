export type ExitWorktreeInput = { action: 'keep' | 'remove'; discardChanges: boolean };

const SLUG_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const MAX_SLUG_CHARS = 64;

export function parseEnterWorktreeInput(args: Record<string, unknown>, fallbackName = () => `session-${crypto.randomUUID().slice(0, 8)}`) {
  assertOnlyKeys(args, ['name']);
  if (args.name === undefined) return { name: fallbackName() };
  if (typeof args.name !== 'string') throw new Error('Worktree name must be a string.');
  validateWorktreeName(args.name);
  return { name: args.name };
}

export function parseExitWorktreeInput(args: Record<string, unknown>): ExitWorktreeInput {
  assertOnlyKeys(args, ['action', 'discard_changes']);
  if (args.action !== 'keep' && args.action !== 'remove') throw new Error('ExitWorktree action must be keep or remove.');
  if (args.discard_changes !== undefined && typeof args.discard_changes !== 'boolean') {
    throw new Error('discard_changes must be a boolean.');
  }
  return { action: args.action, discardChanges: args.discard_changes === true };
}

export function validateWorktreeName(name: string) {
  if (!name || name.length > MAX_SLUG_CHARS || name.includes('\0')) {
    throw new Error('Worktree name must contain 1-64 characters.');
  }
  for (const segment of name.split('/')) {
    if (segment === '.' || segment === '..' || !SLUG_SEGMENT.test(segment)) {
      throw new Error('Each worktree name segment may contain only letters, digits, dots, underscores, and dashes.');
    }
  }
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(`Unexpected input properties: ${extras.join(', ')}.`);
}
