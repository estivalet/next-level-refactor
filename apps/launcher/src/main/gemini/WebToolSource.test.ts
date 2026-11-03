import { AppErrorException, GeminiSettingsSchema, type GeminiSettings } from '@nextlevel/shared';
import { EventEmitter } from 'node:events';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PromptGame } from './prompt.ts';
import { WebToolSource, type ToolProcess } from './WebToolSource.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const game = (gameId: number): PromptGame => ({
  gameId,
  system: 'Coleco Telstar',
  title: `Game ${String(gameId)}`,
  file: 'g.bat',
  known: {},
});
const games = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => game(from + i));

class FakeProcess extends EventEmitter implements ToolProcess {
  readonly stderr = new EventEmitter();
  readonly pid = 4321;
  killed = false;
  kill(): boolean {
    this.killed = true;
    return true;
  }
}

function setup(settings: Partial<GeminiSettings['webTool']> = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'nl-gemini-web-'));
  dirs.push(dataDir);
  const spawned: Array<{ command: string; args: string[]; options: unknown }> = [];
  const processes: FakeProcess[] = [];
  const logged: unknown[] = [];
  const treeKills: number[] = [];
  const source = new WebToolSource({
    killTree: (pid) => {
      treeKills.push(pid);
    },
    dataDir,
    toolPath: 'C:/NextLevel/tools/gemini-web/gemini_web.py',
    settings: () =>
      GeminiSettingsSchema.parse({
        webTool: { python: 'C:/Python/python.exe', firefoxProfile: 'C:/ff/p', ...settings },
      }),
    spawn: (command, args, options) => {
      spawned.push({ command, args, options });
      const child = new FakeProcess();
      processes.push(child);
      return child;
    },
    log: {
      warn: (context) => {
        logged.push(context);
      },
    },
    poll: () => new Promise((resolve) => setTimeout(resolve, 1)),
  });
  const jobDir = (jobId: number) => join(dataDir, 'gemini', 'jobs', String(jobId));
  const answer = (jobId: number, ids: number[]) => {
    appendFileSync(
      join(jobDir(jobId), 'results.jsonl'),
      `${JSON.stringify({
        gameIds: ids,
        reply: `\`\`\`json\n${JSON.stringify(ids.map((gameId) => ({ gameId, year: { known: true, value: 1977 } })))}\n\`\`\``,
      })}\n`,
    );
  };
  return { source, dataDir, spawned, processes, logged, jobDir, answer, treeKills };
}

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppErrorException) return error.error.code;
    throw error;
  }
  return 'resolved';
}

describe('WebToolSource (FR-SCR-7)', () => {
  it('FR-SCR-7: writes the request (no key) and starts the tool with an argv array, no shell', async () => {
    const { source, spawned, jobDir } = setup({ driver: 'C:/d/geckodriver.exe' });
    await source.prepare(4, games(1, 3), ['year'], 'English');
    const request = JSON.parse(readFileSync(join(jobDir(4), 'request.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(request).toEqual({
      jobId: 4,
      fields: ['year'],
      language: 'English',
      games: games(1, 3),
    });
    expect(JSON.stringify(request)).not.toMatch(/key/i);
    expect(spawned[0]).toMatchObject({
      command: 'C:/Python/python.exe',
      args: [
        'C:/NextLevel/tools/gemini-web/gemini_web.py',
        '--request',
        join(jobDir(4), 'request.json'),
        '--profile',
        'C:/ff/p',
        '--driver',
        'C:/d/geckodriver.exe',
      ],
      options: { shell: false, windowsHide: true },
    });
  });

  it('FR-SCR-7: next waits for the lines covering its games and returns their checked-later items', async () => {
    const { source, answer } = setup();
    await source.prepare(4, games(1, 12), ['year'], 'English');
    const pending = source.next(games(1, 10));
    answer(4, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const reply = await pending;
    expect([...reply.items.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(reply.items.get(1)).toEqual({ gameId: 1, year: { known: true, value: 1977 } });
    expect(reply).toMatchObject({ sources: [], grounded: false });
  });

  it('FR-SCR-7: Review Focus 5 — exit 3 after one line: that chunk answers, the next is GEMINI_WEB_TOOL with stderr logged', async () => {
    const { source, answer, processes, logged } = setup();
    await source.prepare(4, games(1, 20), ['year'], 'English');
    answer(
      4,
      games(1, 10).map((g) => g.gameId),
    );
    expect((await source.next(games(1, 10))).items.size).toBe(10);
    const second = source.next(games(11, 20));
    processes[0]?.stderr.emit('data', Buffer.from('Could not find Gemini input box.'));
    processes[0]?.emit('exit', 3);
    expect(await code(second)).toBe('GEMINI_WEB_TOOL');
    expect(JSON.stringify(logged)).toContain('Could not find Gemini input box.');
  });

  it('FR-SCR-7: Python missing (spawn error) is GEMINI_WEB_TOOL', async () => {
    const { source, processes } = setup();
    await source.prepare(4, games(1, 2), ['year'], 'English');
    const pending = source.next(games(1, 2));
    processes[0]?.emit('error', Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }));
    expect(await code(pending)).toBe('GEMINI_WEB_TOOL');
  });

  it('FR-SCR-7: a resumed run keeps results.jsonl, so lines from before are used again', async () => {
    const { source, answer, jobDir } = setup();
    mkdirSync(jobDir(4), { recursive: true });
    answer(4, [1, 2]);
    await source.prepare(4, games(1, 2), ['year'], 'English');
    expect((await source.next(games(1, 2))).items.size).toBe(2);
  });

  it('FR-SCR-7: starting a job removes other jobs’ folders; close stops the tool', async () => {
    const { source, jobDir, treeKills } = setup();
    mkdirSync(jobDir(2), { recursive: true });
    await source.prepare(4, games(1, 2), ['year'], 'English');
    expect(existsSync(jobDir(2))).toBe(false);
    expect(existsSync(jobDir(4))).toBe(true);
    source.close();
    expect(treeKills).toEqual([4321]);
  });

  it('FR-SCR-7: empty Settings paths refuse to start', async () => {
    const { source, spawned } = setup({ python: '' });
    expect(await code(source.prepare(4, games(1, 2), ['year'], 'English'))).toBe('GEMINI_WEB_TOOL');
    expect(spawned).toHaveLength(0);
  });

  it('FR-SCR-7: review fix 4 — a line whose reply has no JSON fails its games (never notFound)', async () => {
    const { source, jobDir } = setup();
    await source.prepare(4, games(1, 2), ['year'], 'English');
    appendFileSync(
      join(jobDir(4), 'results.jsonl'),
      `${JSON.stringify({ gameIds: [1, 2], reply: 'Sorry, something went wrong.' })}
`,
    );
    const reply = await source.next(games(1, 2));
    expect(reply.items.size).toBe(0);
    expect([...(reply.failed ?? [])]).toEqual([1, 2]);
  });

  it('FR-SCR-7: review fix 5 — close stops the whole tool tree (Python, geckodriver, Firefox)', async () => {
    const { source, treeKills } = setup();
    await source.prepare(4, games(1, 2), ['year'], 'English');
    source.close();
    expect(treeKills).toEqual([4321]);
  });
});
