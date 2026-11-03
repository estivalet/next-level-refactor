import { describe, expect, it } from 'vitest';
import { matchPlatform, parsePlatforms } from './launchboxPlatforms.ts';

const XML = `<?xml version="1.0" standalone="yes"?>
<LaunchBox>
  <Platform><Name>Microsoft Xbox 360</Name><Emulated>true</Emulated></Platform>
  <Platform><Name>Sega Genesis</Name><Emulated>true</Emulated></Platform>
  <Platform><Name>Nintendo Entertainment System</Name><Emulated>true</Emulated></Platform>
  <PlatformAlternateName><Name>Sega Genesis</Name><Alternate>Sega Mega Drive</Alternate></PlatformAlternateName>
  <PlatformAlternateName><Name>Nintendo Entertainment System</Name><Alternate>NES</Alternate></PlatformAlternateName>
</LaunchBox>`;

describe('LaunchBox platform per system (FR-SCR-6)', () => {
  const platforms = parsePlatforms(XML);

  it('reads platform names with their alternates', () => {
    expect(platforms).toEqual([
      { name: 'Microsoft Xbox 360', alternates: [] },
      { name: 'Sega Genesis', alternates: ['Sega Mega Drive'] },
      { name: 'Nintendo Entertainment System', alternates: ['NES'] },
    ]);
  });

  it('matches a system name ignoring case and punctuation', () => {
    expect(
      matchPlatform(
        { name: 'Microsoft XBOX 360', defaultFolderName: 'Microsoft XBOX 360' },
        platforms,
      ),
    ).toBe('Microsoft Xbox 360');
  });

  it('matches an alias or a manufacturer + name against an alternate', () => {
    expect(
      matchPlatform(
        { name: 'Mega Drive', manufacturer: 'Sega', defaultFolderName: 'Mega Drive' },
        platforms,
      ),
    ).toBe('Sega Genesis');
    expect(
      matchPlatform({ name: 'Famicom', aliases: ['NES'], defaultFolderName: 'Famicom' }, platforms),
    ).toBe('Nintendo Entertainment System');
  });

  it('answers null when nothing matches exactly', () => {
    expect(
      matchPlatform({ name: 'Coleco Telstar', defaultFolderName: 'Coleco Telstar' }, platforms),
    ).toBeNull();
  });
});
