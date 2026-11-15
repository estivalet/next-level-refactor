import { describe, expect, it } from 'vitest';
import { fillFromLaunchBox, parseLaunchBoxPlatforms } from './launchboxXml.ts';

const XML = `<?xml version="1.0" standalone="yes"?>
<LaunchBox>
  <Platform>
    <Name>Fake Console One</Name>
    <ReleaseDate>1993-10-04T00:00:00-07:00</ReleaseDate>
    <Manufacturer>Acme</Manufacturer>
    <Cpu>Fake CPU</Cpu>
    <Memory>2 MB</Memory>
    <Notes>Fake notes &amp; more</Notes>
  </Platform>
  <Platform><Name>Fake Two</Name></Platform>
  <PlatformAlternateName><Name>Fake Console One</Name><Alternate>FC1</Alternate></PlatformAlternateName>
  <PlatformAlternateName><Name>Fake Console One</Name><Alternate>Fake 1</Alternate></PlatformAlternateName>
</LaunchBox>`;

describe('launchboxXml', () => {
  it('FR-MUS-1: parses a two-platform LaunchBox XML', () => {
    const [one, two] = parseLaunchBoxPlatforms(XML);
    expect(one).toMatchObject({
      name: 'Fake Console One',
      alternateNames: ['FC1', 'Fake 1'],
      releaseYear: 1993,
      manufacturer: 'Acme',
      cpu: 'Fake CPU',
      ram: '2 MB',
      notes: 'Fake notes & more',
    });
    expect(two).toEqual({ name: 'Fake Two', alternateNames: [] });
  });

  it('FR-MUS-5: fillFromLaunchBox keeps existing fields and credits LaunchBox when it filled description', () => {
    const lb = parseLaunchBoxPlatforms(XML)[0] ?? { name: '', alternateNames: [] };
    expect(lb.name).toBe('Fake Console One');
    const base = { models: [], peripherals: [], topGames: [], sources: [] };
    const filled = fillFromLaunchBox({ ...base, manufacturer: 'Mine' }, lb);
    expect(filled.manufacturer).toBe('Mine');
    expect(filled.cpu).toBe('Fake CPU');
    expect(filled.releaseYear).toBe(1993);
    expect(filled.description).toBe('Fake notes & more');
    expect(filled.sources).toEqual([{ name: 'LaunchBox Games Database' }]);

    const kept = fillFromLaunchBox({ ...base, description: 'Own' }, lb);
    expect(kept.description).toBe('Own');
    expect(kept.sources).toEqual([]);
  });
});
