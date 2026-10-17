import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { __test, sha256Hex } from './sha256';

const node = (s: string) => createHash('sha256').update(s).digest('hex');

describe('sha256', () => {
  it('fallback matches known vectors and Node crypto (http without crypto.subtle)', () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(__test.sha256Fallback(enc(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(__test.sha256Fallback(enc('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    for (const s of ['cromiqa-gate-v1:pedal', 'ñandú y acentos áéí', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'y'.repeat(1000)])
      expect(__test.sha256Fallback(enc(s))).toBe(node(s));
  });

  it('async helper agrees with Node crypto', async () => {
    expect(await sha256Hex('cromiqa-gate-v1:test')).toBe(node('cromiqa-gate-v1:test'));
  });
});
