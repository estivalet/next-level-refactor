import { zipSync } from 'fflate';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The fixture Metadata.xml (FR-SCR-6 tests); never the real 518 MB file. */
export const FIXTURE_XML_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'test',
  'fixtures',
  'launchbox',
  'Metadata.xml',
);

/** Writes a Metadata.zip like LaunchBox ships it (the XML next to other files). */
export function writeFixtureZip(path: string, metadataXml?: string): void {
  const xml = metadataXml ?? readFileSync(FIXTURE_XML_PATH, 'utf8');
  const encode = (text: string) => new TextEncoder().encode(text);
  writeFileSync(
    path,
    zipSync({
      'Mame.xml': encode('<LaunchBox></LaunchBox>'),
      'Metadata.xml': encode(xml),
      'Platforms.xml': encode('<LaunchBox></LaunchBox>'),
    }),
  );
}
