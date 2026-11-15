import { describe, expect, it } from 'vitest';
import { SystemInfoSchema, SystemInfoSourceSchema, normalizeTitle } from './info.ts';

describe('system info', () => {
  it('FR-MUS-1: an entry with only systemId parses with empty lists', () => {
    const entry = SystemInfoSchema.parse({ systemId: 'nes' });
    expect(entry.models).toEqual([]);
    expect(entry.peripherals).toEqual([]);
    expect(entry.topGames).toEqual([]);
    expect(entry.sources).toEqual([]);
  });

  it('FR-MUS-1: blank text fields are rejected, not stored', () => {
    expect(SystemInfoSchema.safeParse({ systemId: 'nes', manufacturer: '  ' }).success).toBe(false);
  });

  it('FR-MUS-1: text limits fit real launch prices, generations and hardware text', () => {
    const ok = SystemInfoSchema.safeParse({
      systemId: 'x',
      generation: 'g'.repeat(120),
      unitsSold: 'u'.repeat(120),
      media: 'm'.repeat(600),
      models: [{ name: 'M', launchPrice: 'p'.repeat(200), cpu: 'c'.repeat(400) }],
    });
    expect(ok.success).toBe(true);
    const tooLong = SystemInfoSchema.safeParse({
      systemId: 'x',
      models: [{ name: 'M', launchPrice: 'p'.repeat(201) }],
    });
    expect(tooLong.success).toBe(false);
  });

  it('FR-MUS-5: a source url must be http(s)', () => {
    expect(
      SystemInfoSourceSchema.safeParse({ name: 'X', url: 'javascript:alert(1)' }).success,
    ).toBe(false);
    expect(
      SystemInfoSourceSchema.safeParse({ name: 'X', url: 'https://en.wikipedia.org/wiki/X' })
        .success,
    ).toBe(true);
  });

  it('FR-MUS-3: normalizeTitle ignores case, tags and punctuation', () => {
    expect(normalizeTitle('Super Mario Bros. 3 (USA) [!]')).toBe(
      normalizeTitle('super mario bros 3'),
    );
    expect(normalizeTitle('Mega Man 2')).not.toBe(normalizeTitle('Mega Man 3'));
  });
});
