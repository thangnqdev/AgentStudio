import { describe, expect, it } from 'vitest';
import { shouldIgnoreWorkspacePath, shouldIndexWorkspaceFile } from './knowledgeWorkspacePolicy.js';

describe('knowledge workspace policy', () => {
  it('indexes supported source files while excluding generated and sensitive paths', () => {
    expect(shouldIndexWorkspaceFile('src/services/booking.ts')).toBe(true);
    expect(shouldIndexWorkspaceFile('docs/schema.sql')).toBe(true);
    expect(shouldIndexWorkspaceFile('node_modules/pkg/index.js')).toBe(false);
    expect(shouldIndexWorkspaceFile('.env.production')).toBe(false);
    expect(shouldIndexWorkspaceFile('keys/production.pem')).toBe(false);
    expect(shouldIgnoreWorkspacePath('dist/assets/index.js')).toBe(true);
  });
});
