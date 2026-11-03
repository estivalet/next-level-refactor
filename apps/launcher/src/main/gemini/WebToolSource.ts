import {
  AppErrorException,
  ERROR_CODES,
  GeminiWebResultLineSchema,
  type GeminiField,
  type GeminiSettings,
  type GeminiWebRequest,
} from '@nextlevel/shared';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from '../fs/atomicWrite.ts';
import { itemsById } from './apiSource.ts';
import type { AnswerSource, SourceReply } from './GeminiBatchService.ts';
import { parseReply, type PromptGame } from './prompt.ts';

/** What the launcher needs from the tool's child process. */
export interface ToolProcess {
  on(event: 'exit', listener: (code: number | null) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  stderr: { on(event: 'data', listener: (chunk: Buffer) => void): unknown } | null;
  pid?: number | undefined;
  kill(): boolean;
}

export interface WebToolDeps {
  dataDir: string;
  /** tools/gemini-web/gemini_web.py */
  toolPath: string;
  settings: () => GeminiSettings;
  spawn: (
    command: string,
    args: string[],
    options: { shell: false; windowsHide: true; cwd?: string },
  ) => ToolProcess;
  log: { warn(context: object, message: string): void };
  /**
   * Ends the tool and everything it started (geckodriver, Firefox): killing Python alone leaves
   * Firefox holding the profile lock (`taskkill /T /F` on Windows).
   */
  killTree: (pid: number) => void;
  /** Waits between reads of results.jsonl. */
  poll: () => Promise<void>;
}

/** Keep the end of the tool's stderr for the log (its last line says why it stopped). */
const STDERR_TAIL = 2000;

const toolFailed = (reason: string) =>
  new AppErrorException({
    code: 'GEMINI_WEB_TOOL',
    message: ERROR_CODES.GEMINI_WEB_TOOL,
    details: { reason },
  });

/**
 * The batch's website route (FR-SCR-7, spec §8): writes `<data>\gemini\jobs\<id>\request.json`,
 * starts tools/gemini-web once per run, and serves each chunk from the lines the tool appends
 * to `results.jsonl`. It never lets Python touch library.db; replies are checked in main.
 */
export class WebToolSource implements AnswerSource {
  private child: ToolProcess | null = null;
  private exited: string | null = null;
  private stderr = '';
  private folder: string | null = null;

  constructor(private readonly deps: WebToolDeps) {}

  private jobsDir(): string {
    return join(this.deps.dataDir, 'gemini', 'jobs');
  }

  async prepare(
    jobId: number,
    games: PromptGame[],
    fields: GeminiField[],
    language: string,
  ): Promise<void> {
    const { python, firefoxProfile, driver } = this.deps.settings().webTool;
    if (python === '' || firefoxProfile === '') throw toolFailed('notSetUp');
    await this.sweep(jobId);
    const folder = join(this.jobsDir(), String(jobId));
    await mkdir(folder, { recursive: true });
    const request: GeminiWebRequest = { jobId, fields, language, games };
    const file = join(folder, 'request.json');
    await atomicWrite(file, JSON.stringify(request));
    this.folder = folder;
    this.exited = null;
    this.stderr = '';
    const args = [this.deps.toolPath, '--request', file, '--profile', firefoxProfile];
    if (driver !== '') args.push('--driver', driver);
    const child = this.deps.spawn(python, args, { shell: false, windowsHide: true });
    this.child = child;
    child.stderr?.on('data', (chunk) => {
      this.stderr = (this.stderr + chunk.toString('utf8')).slice(-STDERR_TAIL);
    });
    child.on('error', (error) => {
      this.exited = `spawn: ${error.message}`;
    });
    child.on('exit', (code) => {
      this.exited = `exit ${String(code)}`;
    });
  }

  async next(games: PromptGame[]): Promise<SourceReply> {
    const wanted = new Set(games.map((game) => game.gameId));
    for (;;) {
      const exited = this.exited;
      const lines = await this.lines();
      const covered = lines.filter((line) => line.gameIds.some((id) => wanted.has(id)));
      const ids = new Set(covered.flatMap((line) => line.gameIds));
      if ([...wanted].every((id) => ids.has(id))) {
        const items: unknown[] = [];
        const failed = new Set<number>();
        for (const line of covered) {
          const parsed = parseReply(line.reply);
          if (parsed) items.push(...parsed);
          else for (const id of line.gameIds) if (wanted.has(id)) failed.add(id);
        }
        return { items: itemsById(items, wanted), failed, sources: [], grounded: false };
      }
      if (exited !== null) {
        this.deps.log.warn({ reason: exited, stderr: this.stderr }, 'gemini website tool stopped');
        throw toolFailed(exited);
      }
      await this.deps.poll();
    }
  }

  close(): void {
    const child = this.child;
    this.child = null;
    if (!child || this.exited !== null) return;
    if (child.pid === undefined) child.kill();
    else this.deps.killTree(child.pid);
  }

  /** The tool's lines so far; a half-written last line is skipped until it's complete. */
  private async lines() {
    if (!this.folder) return [];
    let text: string;
    try {
      text = await readFile(join(this.folder, 'results.jsonl'), 'utf8');
    } catch {
      return [];
    }
    return text.split('\n').flatMap((line) => {
      try {
        const parsed = GeminiWebResultLineSchema.safeParse(JSON.parse(line));
        return parsed.success ? [parsed.data] : [];
      } catch {
        return [];
      }
    });
  }

  /** Job folders of other jobs are left-overs (finished, cancelled or replaced). */
  private async sweep(keep: number): Promise<void> {
    let names: string[];
    try {
      names = await readdir(this.jobsDir());
    } catch {
      return;
    }
    await Promise.all(
      names
        .filter((name) => name !== String(keep))
        .map((name) => rm(join(this.jobsDir(), name), { recursive: true, force: true })),
    );
  }
}
