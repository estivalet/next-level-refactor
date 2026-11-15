import { describe, expect, it } from 'vitest';
import { systemCatalog } from '../../src/index.ts';
import { runImport } from './runImport.ts';

const systems = systemCatalog();

const platformXml = (name: string): string =>
  `<LaunchBox><Platform><Name>${name}</Name><Manufacturer>Acme</Manufacturer></Platform></LaunchBox>`;

describe('runImport', () => {
  it('FR-MUS-1: runImport matches, reports unparseable and unmatched', () => {
    const name = systems[0]?.name ?? '';
    const { seed, report } = runImport(
      [
        { name: `${name}.json`, text: JSON.stringify({ description: 'Fine.' }) },
        { name: `${systems[1]?.name ?? ''}.json`, text: '{bad' },
        { name: 'No Such Machine.json', text: '{"description":"x"}' },
      ],
      null,
      systems,
    );
    expect(report.matched).toBe(1);
    expect(report.unparseable).toEqual([systems[1]?.name]);
    expect(report.unmatched).toEqual(['No Such Machine']);
    expect(seed.entries[0]?.systemId).toBe(systems[0]?.id);
    expect(seed.entries[0]?.description).toBe('Fine.');
  });

  it('FR-MUS-1: an XML-only platform still produces an entry', () => {
    const target = systems[0];
    if (!target) throw new Error('empty catalog');
    const { seed, report } = runImport([], platformXml(target.name), systems);
    expect(report.matched).toBe(1);
    expect(seed.entries).toEqual([
      expect.objectContaining({ systemId: target.id, manufacturer: 'Acme' }),
    ]);
  });

  it('FR-MUS-1: duplicates keep the richer file', () => {
    const target = systems[0];
    if (!target) throw new Error('empty catalog');
    const { seed, report } = runImport(
      [
        { name: `${target.name}.json`, text: '{"description":"d"}' },
        { name: `${target.name.toUpperCase()}.json`, text: '{"description":"d","cpu":"Z80"}' },
      ],
      null,
      systems,
    );
    expect(seed.entries).toHaveLength(1);
    expect(seed.entries[0]?.cpu).toBe('Z80');
    expect(report.unmatched).toHaveLength(1);
    expect(report.unmatched[0]).toContain(`(duplicate of ${target.id})`);
  });
});
