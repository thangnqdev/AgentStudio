import { describe, expect, it } from 'vitest';
import { getLocalToolDefinition } from '../../infrastructure/tools/localToolDefinitions.js';
import { parseAndValidateToolArguments } from './toolArgumentValidation.js';

describe('parseAndValidateToolArguments', () => {
  it('rejects malformed JSON and missing required fields', () => {
    const tool = getLocalToolDefinition('write_file')!;
    expect(parseAndValidateToolArguments('{', tool)).toMatchObject({ ok: false, error: 'Invalid arguments: expected a JSON object.' });
    expect(parseAndValidateToolArguments('{"path":"file.txt"}', tool)).toMatchObject({ ok: false, error: expect.stringContaining('"content" is missing') });
  });

  it('rejects values with an incompatible schema type', () => {
    const tool = getLocalToolDefinition('run_command')!;
    expect(parseAndValidateToolArguments('{"command":"pwd","timeoutMs":"fast"}', tool)).toMatchObject({ ok: false, error: expect.stringContaining('"timeoutMs" must be number') });
  });

  it('keeps valid arguments available to the executor', () => {
    const tool = getLocalToolDefinition('write_file')!;
    expect(parseAndValidateToolArguments('{"path":"file.txt","content":"hello"}', tool)).toEqual({ ok: true, args: { path: 'file.txt', content: 'hello' } });
  });
});
