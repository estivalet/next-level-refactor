import type { GeminiKeyStatus } from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';
import type { SecretsLike } from '../secrets/SecretStore.ts';
import type { GeminiClient } from './GeminiClient.ts';
import type { GeminiBatchService } from './GeminiBatchService.ts';
import type { GeminiService } from './GeminiService.ts';

type GeminiChannel = Extract<keyof IpcHandlers, `gemini.${string}`>;

/** Gemini fill channels (FR-SCR-7); the key goes to the OS secret store, never settings. */
export function createGeminiHandlers(deps: {
  secrets: Pick<SecretsLike, 'available' | 'has' | 'setMany'>;
  library: () => {
    gemini: Pick<GeminiService, 'ask' | 'stored' | 'apply' | 'dismiss'>;
    geminiClient: Pick<GeminiClient, 'test'>;
    geminiBatch: Pick<GeminiBatchService, 'start' | 'pause' | 'resume' | 'cancel' | 'status'>;
  };
}): Pick<IpcHandlers, GeminiChannel> {
  const status = async (): Promise<GeminiKeyStatus> => ({
    available: await deps.secrets.available(),
    set: await deps.secrets.has('gemini.apiKey'),
  });
  return {
    'gemini.key.status': status,
    'gemini.key.set': async ({ apiKey }) => {
      await deps.secrets.setMany({ 'gemini.apiKey': apiKey });
      return status();
    },
    'gemini.test': async () => {
      await deps.library().geminiClient.test();
      return { ok: true as const };
    },
    'gemini.ask': ({ gameId, allFields }) => deps.library().gemini.ask(gameId, allFields),
    'gemini.stored': ({ gameId }) => deps.library().gemini.stored(gameId),
    'gemini.apply': ({ gameId, fields }) => deps.library().gemini.apply(gameId, fields),
    'gemini.dismiss': ({ gameId }) => {
      deps.library().gemini.dismiss(gameId);
    },
    'gemini.batch.start': ({ scope, rules }) => deps.library().geminiBatch.start(scope, rules),
    'gemini.batch.pause': () => deps.library().geminiBatch.pause(),
    'gemini.batch.resume': () => deps.library().geminiBatch.resume(),
    'gemini.batch.cancel': () => deps.library().geminiBatch.cancel(),
    'gemini.batch.status': () => deps.library().geminiBatch.status(),
  };
}
