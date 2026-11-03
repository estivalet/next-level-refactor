import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { perfBudget, seedManyGames, tempLibrary } from './testing.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
beforeAll(async () => {
  library = await tempLibrary();
  for (let i = 0; i < 8; i += 1) seedManyGames(library.db, `system-${String(i)}`, 10_000);
  library.db.$client.exec(`insert into game_media (game_id, kind, path, size, version)
    select id, 'box-front', 'C:/x.png', 1, 1 from games where id % 2 = 0`);
}, 180_000);
afterAll(async () => {
  await library.cleanup();
});

describe('System health performance', () => {
  it('FR-LIB-12: the health of 80k games answers in budget', () => {
    const started = performance.now();
    expect(library.repo.systemHealth()).toHaveLength(8);
    expect(performance.now() - started).toBeLessThanOrEqual(perfBudget(1000));
  });
});
