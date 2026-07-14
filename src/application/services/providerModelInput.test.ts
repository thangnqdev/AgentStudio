import { describe, expect, it } from 'vitest';
import { parseProviderModelInput } from './providerModelInput';

describe('parseProviderModelInput', () => {
  it('trims, de-duplicates and accepts commas or new lines', () => {
    expect(parseProviderModelInput(' model-a,model-b\nmodel-a\n ')).toEqual([
      { id: 'model-a' },
      { id: 'model-b' },
    ]);
  });

  it('preserves known context metadata for unchanged model IDs', () => {
    expect(parseProviderModelInput('model-a\nmodel-new', [
      { id: 'model-a', contextWindow: 128_000 },
    ])).toEqual([
      { id: 'model-a', contextWindow: 128_000 },
      { id: 'model-new' },
    ]);
  });
});
