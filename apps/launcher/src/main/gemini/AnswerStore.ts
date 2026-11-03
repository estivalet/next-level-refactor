import { GeminiAnswerSchema, type GeminiAnswer } from '@nextlevel/shared';
import type { LibraryDb } from '../library/openLibrary.ts';

/** Gemini answers waiting in Needs review (`gemini_answers`, FR-SCR-7). */
export class AnswerStore {
  constructor(private readonly db: LibraryDb) {}

  /** The stored answer; an unreadable row reads as none. */
  get(gameId: number): GeminiAnswer | null {
    const raw = this.db.$client
      .prepare('select answer from gemini_answers where game_id = ?')
      .pluck()
      .get(gameId) as string | undefined;
    if (raw === undefined) return null;
    try {
      const parsed = GeminiAnswerSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  set(answer: GeminiAnswer): void {
    this.db.$client
      .prepare(
        `insert into gemini_answers (game_id, answer, asked_at) values (?, ?, ?)
         on conflict (game_id) do update set answer = excluded.answer, asked_at = excluded.asked_at`,
      )
      .run(answer.gameId, JSON.stringify(answer), answer.askedAt);
  }

  delete(gameId: number): void {
    this.db.$client.prepare('delete from gemini_answers where game_id = ?').run(gameId);
  }
}
