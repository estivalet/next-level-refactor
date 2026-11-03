import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { parseMetadataZip, scanBlocks, type LbRecord } from './parseMetadata.ts';
import { writeFixtureZip } from './testing.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function fixtureZip() {
  const temp = await tempDir('nextlevel-launchbox-');
  cleanups.push(temp.cleanup);
  const zip = join(temp.dir, 'Metadata.zip');
  writeFixtureZip(zip);
  return zip;
}

async function parse(zip: string) {
  const records: LbRecord[] = [];
  await parseMetadataZip(zip, (record) => records.push(record));
  return records;
}

describe('parseMetadataZip (FR-SCR-6)', () => {
  it('reads games, alternate names and images from the zipped Metadata.xml', async () => {
    const records = await parse(await fixtureZip());
    const games = records.filter((r) => r.kind === 'game');
    const images = records.filter((r) => r.kind === 'image');
    expect(games.find((g) => g.id === 472523)).toEqual({
      kind: 'game',
      id: 472523,
      name: 'Ace Driver Collection',
      platform: 'Microsoft Xbox 360',
      year: 2026,
      developer: 'Wans Zai',
      publisher: 'Project Aces',
      genres: 'Racing',
      players: '2',
      overview: 'Three Namco racers in one collection.',
      rating: 4.3,
    });
    expect(games.find((g) => g.id === 438312)).toMatchObject({
      year: 2010,
      overview: 'Survive the undead.\nSecond line.',
      rating: null,
    });
    expect(games.find((g) => g.name === 'Tom & Jerry')).toBeDefined();
    expect(images.filter((i) => i.id === 472523).map((i) => i.type)).toEqual([
      'Clear Logo',
      'Fanart - Background',
      'Fanart - Box - Front',
      'Fanart - Box - Front',
    ]);
    expect(images.find((i) => i.fileName === 'dracula-eu.jpg')).toEqual({
      kind: 'image',
      id: 438312,
      fileName: 'dracula-eu.jpg',
      type: 'Box - Front',
      region: 'Europe',
    });
    expect(records.filter((r) => r.kind === 'alternate')).toEqual([
      { kind: 'alternate', id: 472523, name: 'Ace Driver Trilogy' },
    ]);
  });

  it('a block split across chunks anywhere is read whole', () => {
    const xml =
      '<LaunchBox><Game><Name>A &amp; B</Name><DatabaseID>7</DatabaseID><Platform>P</Platform></Game></LaunchBox>';
    const records: LbRecord[] = [];
    const scanner = scanBlocks((record) => records.push(record));
    for (let i = 0; i < xml.length; i += 7) scanner.push(xml.slice(i, i + 7));
    scanner.end();
    expect(records).toEqual([
      {
        kind: 'game',
        id: 7,
        name: 'A & B',
        platform: 'P',
        year: null,
        developer: null,
        publisher: null,
        genres: null,
        players: null,
        overview: null,
        rating: null,
      },
    ]);
  });

  it('an aborted parse rejects and reports no more records', async () => {
    const zip = await fixtureZip();
    const controller = new AbortController();
    controller.abort();
    const records: LbRecord[] = [];
    await expect(
      parseMetadataZip(zip, (record) => records.push(record), undefined, controller.signal),
    ).rejects.toThrow(/abort/i);
    expect(records).toEqual([]);
  });

  it('a zip cut short rejects instead of hanging', async () => {
    const zip = await fixtureZip();
    const { readFileSync, writeFileSync } = await import('node:fs');
    const bytes = readFileSync(zip);
    writeFileSync(zip, bytes.subarray(0, Math.floor(bytes.length / 2)));
    await expect(parse(zip)).rejects.toThrow();
  });

  it('a numeric entity out of range is kept as written instead of ending the build', () => {
    const records: LbRecord[] = [];
    const scanner = scanBlocks((record) => records.push(record));
    scanner.push(
      '<Game><Name>Bad &#99999999; Entity</Name><DatabaseID>8</DatabaseID><Platform>P</Platform></Game>',
    );
    scanner.end();
    expect(records[0]).toMatchObject({ name: 'Bad &#99999999; Entity' });
  });
});
