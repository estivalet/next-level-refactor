import {
  AppErrorException,
  ERROR_CODES,
  GEMINI_FIELDS,
  type GameDetails,
  type GeminiAnswer,
  type GeminiDialogView,
  type GeminiField,
  type ScrapeApplyResult,
  type ScrapeField,
  type Settings,
} from '@nextlevel/shared';
import type { EmitEvent } from '../ipc/events.ts';
import type { GameRepository } from '../library/GameRepository.ts';
import type { MediaRepository } from '../library/MediaRepository.ts';
import type { ScrapeRepository } from '../library/ScrapeRepository.ts';
import type { MediaWriter } from '../scraper/MediaWriter.ts';
import { writeScrape } from '../scraper/writeScrape.ts';
import type { AnswerStore } from './AnswerStore.ts';
import { checkAnswer } from './checks.ts';
import type { GeminiClient } from './GeminiClient.ts';
import type { PromptGame } from './prompt.ts';

export interface GeminiServiceDeps {
  client: Pick<GeminiClient, 'ask'>;
  answers: Pick<AnswerStore, 'get' | 'set' | 'delete'>;
  games: Pick<GameRepository, 'get' | 'applyScraped'>;
  media: Pick<MediaRepository, 'upsert' | 'repoint'>;
  scrapes: Pick<ScrapeRepository, 'set' | 'get' | 'delete'>;
  writer: Pick<MediaWriter, 'write'>;
  transaction: (fn: () => void) => void;
  settings: () => Settings;
  /** The catalog name Gemini is told ("Coleco Telstar"). */
  systemName: (systemId: string) => string;
  emit: EmitEvent;
  clock: () => Date;
}

/** Language names for the description (spec §6); anything else falls back to English. */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  pt: 'Brazilian Portuguese',
  'pt-BR': 'Brazilian Portuguese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ja: 'Japanese',
  nl: 'Dutch',
};

const isEmpty = (value: unknown) => value === null || value === undefined || value === '';

/** What a batch did with one answer. */
export type RecordOutcome = 'applied' | 'review' | 'notFound';

/**
 * Gemini fills missing details (FR-SCR-7): asks about one game, keeps the checked answer until
 * it's applied or dismissed, and writes through the shared writeScrape as provider `gemini`.
 */
export class GeminiService {
  constructor(private readonly deps: GeminiServiceDeps) {}

  /** The description language: scraper language priority, else the app language, else English. */
  language(): string {
    const settings = this.deps.settings();
    const code = settings.scraper.languagePriority[0] ?? settings.general.language;
    return LANGUAGE_NAMES[code] ?? 'English';
  }

  /** The game as the prompt shows it; `fields` are the ones to ask. */
  promptGame(game: GameDetails): PromptGame {
    const known: PromptGame['known'] = {};
    for (const field of GEMINI_FIELDS) {
      const value = game[field];
      if (!isEmpty(value)) known[field] = value;
    }
    return {
      gameId: game.id,
      system: this.deps.systemName(game.systemId),
      title: game.title,
      file: game.relPath.split(/[\\/]/).pop() ?? game.relPath,
      known,
    };
  }

  /** Empty fields the user hasn't locked (D19): what a batch or the dialog asks by default. */
  emptyFields(game: GameDetails, among: readonly GeminiField[] = GEMINI_FIELDS): GeminiField[] {
    return among.filter((field) => isEmpty(game[field]) && !game.lockedFields.includes(field));
  }

  async ask(gameId: number, allFields = false): Promise<GeminiDialogView> {
    const game = this.deps.games.get(gameId);
    const empty = this.emptyFields(game);
    // Nothing empty: ask everything, so the dialog has something to compare.
    const fields = allFields || empty.length === 0 ? [...GEMINI_FIELDS] : empty;
    const promptGame = this.promptGame(game);
    const reply = await this.deps.client.ask(
      [{ ...promptGame, known: allFields ? {} : promptGame.known }],
      fields,
      this.language(),
    );
    const raw = reply.items.find(
      (item) => (item as { gameId?: unknown } | null)?.gameId === gameId,
    );
    const answer: GeminiAnswer = {
      gameId,
      route: 'api',
      ...checkAnswer(raw, { gameId, title: game.title }, fields, this.deps.clock()),
      sources: reply.sources,
      grounded: reply.grounded,
      askedAt: this.deps.clock().toISOString(),
    };
    this.deps.answers.set(answer);
    return this.view(game, answer);
  }

  stored(gameId: number): GeminiDialogView | null {
    const answer = this.deps.answers.get(gameId);
    return answer ? this.view(this.deps.games.get(gameId), answer) : null;
  }

  /** Writes the ticked fields (the title only when ticked here); locked ticked ones on purpose. */
  async apply(gameId: number, fields: ScrapeField[]): Promise<ScrapeApplyResult> {
    const answer = this.deps.answers.get(gameId);
    if (!answer) {
      throw new AppErrorException({
        code: 'GEMINI_NO_ANSWER',
        message: ERROR_CODES.GEMINI_NO_ANSWER,
        details: { gameId },
      });
    }
    const values: Partial<Record<ScrapeField, string | number>> = {};
    for (const field of fields) {
      const value = field === 'title' ? answer.title : answer.fields[field as GeminiField]?.value;
      if (value !== null && value !== undefined) values[field] = value;
    }
    const result = await this.write(this.deps.games.get(gameId), values, fields, false);
    this.deps.answers.delete(gameId);
    return result;
  }

  dismiss(gameId: number): void {
    this.deps.answers.delete(gameId);
    const status = this.deps.scrapes.get(gameId);
    if (status?.provider === 'gemini' && status.status === 'review') {
      this.deps.scrapes.delete(gameId);
    }
  }

  /**
   * A batch answer (API or website): nothing known → notFound (no status change); review →
   * stored + Needs review; auto → only fields still empty and unlocked now, never the title,
   * and an answer grounded without any source goes to review instead (spec §6).
   */
  async record(
    answer: GeminiAnswer,
    mode: 'review' | 'auto',
    fields: readonly GeminiField[],
  ): Promise<RecordOutcome> {
    const known = fields.filter((field) => answer.fields[field]?.known === true);
    if (known.length === 0) {
      this.deps.answers.delete(answer.gameId);
      return 'notFound';
    }
    const unsourced = answer.grounded && answer.sources.length === 0;
    if (mode === 'review' || unsourced) {
      this.deps.answers.set(answer);
      this.deps.scrapes.set(answer.gameId, {
        provider: 'gemini',
        status: 'review',
        providerGameId: null,
        candidates: 0,
        error: null,
        scrapedAt: this.deps.clock().toISOString(),
      });
      const { systemId } = this.deps.games.get(answer.gameId);
      this.deps.emit('library.changed', { systems: [systemId], gameIds: [answer.gameId] });
      return 'review';
    }
    const game = this.deps.games.get(answer.gameId);
    const values: Partial<Record<ScrapeField, string | number>> = {};
    for (const field of this.emptyFields(game, known)) {
      const value = answer.fields[field]?.value;
      if (value !== null && value !== undefined) values[field] = value;
    }
    this.deps.answers.delete(answer.gameId);
    if (Object.keys(values).length === 0) return 'notFound';
    await this.write(game, values, [], true);
    return 'applied';
  }

  private write(
    game: GameDetails,
    values: Partial<Record<ScrapeField, string | number>>,
    overrideLocked: readonly ScrapeField[],
    batch: boolean,
  ): Promise<ScrapeApplyResult> {
    return writeScrape(
      { ...this.deps, mediaDir: () => null },
      {
        game,
        provider: 'gemini',
        providerGameId: null,
        kinds: [],
        fetchArt: () => Promise.resolve(null),
        values,
        overrideLocked,
        candidates: 0,
        batch,
      },
    );
  }

  private view(game: GameDetails, answer: GeminiAnswer): GeminiDialogView {
    const fields: GeminiDialogView['fields'] = {};
    for (const field of GEMINI_FIELDS) {
      const checked = answer.fields[field];
      if (!checked) continue;
      fields[field] = {
        current: game[field] ?? null,
        scraped: checked.value,
        locked: game.lockedFields.includes(field),
      };
    }
    fields.title = {
      current: game.title,
      scraped: answer.title,
      locked: game.lockedFields.includes('title'),
    };
    return { answer, fields };
  }
}
