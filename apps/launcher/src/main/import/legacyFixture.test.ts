import {
  LegacyConfigSchema,
  LegacyGameSchema,
  LegacyGamelistSchema,
  LegacyLaunchersSchema,
  LegacyMenuSchema,
  LegacyScreenscraperSchema,
  LegacyThemesSchema,
} from '@nextlevel/shared';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGACY_FIXTURE } from './testing.ts';

const data = join(LEGACY_FIXTURE, 'data');
const json = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(join(data, path), 'utf8'));

describe('NextLevelOS legacy fixture', () => {
  it('FR-IMP-1: every settings and menu file parses', async () => {
    expect(LegacyConfigSchema.parse(await json('config.json')).storage).toHaveLength(3);
    expect(Object.keys(LegacyLaunchersSchema.parse(await json('launchers.json')))).toContain(
      'Amstrad GX4000',
    );
    expect(LegacyMenuSchema.parse(await json('menu.json')).items.length).toBeGreaterThan(0);
    expect(LegacyMenuSchema.parse(await json('menu-arcade.json')).title).toBe('Arcade Cabinet');
    expect(LegacyThemesSchema.parse(await json('themes.json')).themes).toHaveLength(3);
    expect(LegacyScreenscraperSchema.parse(await json('screenscraper.json'))).toHaveProperty(
      'Nintendo 64',
      999,
    );
  });

  it('FR-IMP-1: gamelists parse, except the report file and the broken one', async () => {
    const files = (await readdir(join(data, 'gamelists'))).filter((f) => f.endsWith('.json'));
    const outcome: Record<string, string> = {};
    for (const file of files) {
      const text = await readFile(join(data, 'gamelists', file), 'utf8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        outcome[file] = 'invalidFile';
        continue;
      }
      const list = LegacyGamelistSchema.safeParse(parsed);
      if (!list.success) {
        outcome[file] = 'notAGamelist';
        continue;
      }
      const bad = list.data.games.filter((game) => !LegacyGameSchema.safeParse(game).success);
      outcome[file] = bad.length > 0 ? `ok, ${String(bad.length)} invalid` : 'ok';
    }
    expect(outcome).toMatchObject({
      'Broken.json': 'invalidFile',
      'Sony Playstation_metadata_report.json': 'notAGamelist',
      'Atari 2600.json': 'ok, 1 invalid',
      'Party Picks.json': 'ok',
    });
  });
});
