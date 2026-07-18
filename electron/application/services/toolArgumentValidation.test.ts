import { describe, expect, it } from 'vitest';
import { getLocalToolDefinition } from '../../infrastructure/tools/localToolDefinitions.js';
import { getInteractiveToolDefinitions } from './interactiveToolDefinitions.js';
import { parseAndValidateToolArguments } from './toolArgumentValidation.js';
import { WEB_FETCH_TOOL_DEFINITION } from '../../domain/entities/webFetch.js';

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

  it('recovers structured values stringified by OpenAI-compatible providers', () => {
    const tool = getInteractiveToolDefinitions().find((definition) => definition.name === 'AskUserQuestion')!;
    const questions = [{
      question: 'Which approach?', header: 'Approach', multiSelect: false,
      options: [
        { label: 'Ports', description: 'Keep dependencies inward.' },
        { label: 'Direct', description: 'Use infrastructure directly.' },
      ],
    }];
    const raw = JSON.stringify({ questions: `\n${JSON.stringify(questions)}\n` });
    expect(parseAndValidateToolArguments(raw, tool)).toEqual({ ok: true, args: { questions } });
  });

  it('does not coerce ordinary strings or invalid structured values', () => {
    const tool = getLocalToolDefinition('run_command')!;
    expect(parseAndValidateToolArguments('{"command":"[1,2]"}', tool)).toEqual({ ok: true, args: { command: '[1,2]' } });
    expect(parseAndValidateToolArguments('{"command":"pwd","timeoutMs":"[1,2]"}', tool)).toMatchObject({
      ok: false, error: expect.stringContaining('"timeoutMs" must be number'),
    });
  });

  it('rejects unknown fields for strict tool contracts', () => {
    expect(parseAndValidateToolArguments('{"url":"https://example.com","prompt":"read","extra":true}', WEB_FETCH_TOOL_DEFINITION))
      .toMatchObject({ ok: false, error: 'Invalid arguments: unknown property "extra".' });
  });

  it('enforces numeric, string, array and pattern bounds from trusted schemas', () => {
    const tool = {
      name: 'bounded', description: '', risk: 'read' as const,
      parameters: {
        type: 'object', properties: {
          count: { type: 'integer', minimum: 1, maximum: 3 },
          id: { type: 'string', minLength: 2, maxLength: 4, pattern: '^[a-z]+$' },
          values: { type: 'array', maxItems: 2 },
        },
      },
    };
    expect(parseAndValidateToolArguments('{"count":4,"id":"ok","values":[]}', tool)).toMatchObject({ ok: false, error: expect.stringContaining('maximum') });
    expect(parseAndValidateToolArguments('{"count":1,"id":"A","values":[]}', tool)).toMatchObject({ ok: false, error: expect.stringContaining('too short') });
    expect(parseAndValidateToolArguments('{"count":1,"id":"AA","values":[]}', tool)).toMatchObject({ ok: false, error: expect.stringContaining('invalid format') });
    expect(parseAndValidateToolArguments('{"count":1,"id":"ok","values":[1,2,3]}', tool)).toMatchObject({ ok: false, error: expect.stringContaining('too many') });
  });
});
