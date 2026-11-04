import { describe, expect, it } from 'vitest';
import { compareCloudHeads } from '@core/application/CloudConflict';

describe('cloud checkpoint ancestry', () => {
  const graph = new Map([['a', []], ['b', ['a']], ['c', ['b']], ['x', ['a']]] as const);
  it('recognizes only proven ancestry and preserves branches as conflicts', () => {
    expect(compareCloudHeads('a', 'c', graph)).toBe('cloud-descends-from-local');
    expect(compareCloudHeads('c', 'b', graph)).toBe('local-descends-from-cloud');
    expect(compareCloudHeads('c', 'x', graph)).toBe('conflict');
    expect(compareCloudHeads('missing', 'c', graph)).toBe('unknown');
  });
});
