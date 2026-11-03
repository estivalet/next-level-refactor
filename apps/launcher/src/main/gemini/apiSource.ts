import type { AnswerSource } from './GeminiBatchService.ts';
import type { GeminiClient } from './GeminiClient.ts';

/** Raw reply items by gameId: only ids that were asked, the first item per id (Review Focus 1). */
export function itemsById(items: unknown[], asked: ReadonlySet<number>): Map<number, unknown> {
  const byId = new Map<number, unknown>();
  for (const item of items) {
    const id = (item as { gameId?: unknown } | null)?.gameId;
    if (typeof id === 'number' && asked.has(id) && !byId.has(id)) byId.set(id, item);
  }
  return byId;
}

/** The batch's API route (FR-SCR-7): one Gemini request per chunk of games. */
export function apiSource(client: Pick<GeminiClient, 'ask'>): AnswerSource {
  return {
    next: async (games, fields, language) => {
      const reply = await client.ask(games, fields, language);
      const asked = new Set(games.map((game) => game.gameId));
      return {
        items: itemsById(reply.items, asked),
        sources: reply.sources,
        grounded: reply.grounded,
      };
    },
  };
}
