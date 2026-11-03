import { IDLE_BATCH } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { memorySecrets } from '../secrets/testing.ts';
import { createGeminiHandlers } from './geminiHandlers.ts';

function setup() {
  const secrets = memorySecrets();
  const calls: string[] = [];
  const view = { answer: {}, fields: {} } as never;
  const handlers = createGeminiHandlers({
    secrets,
    library: () => ({
      gemini: {
        ask: (gameId: number, allFields?: boolean) => {
          calls.push(`ask ${String(gameId)} ${String(allFields)}`);
          return Promise.resolve(view);
        },
        stored: (gameId: number) => {
          calls.push(`stored ${String(gameId)}`);
          return null;
        },
        apply: (gameId: number, fields: string[]) => {
          calls.push(`apply ${String(gameId)} ${fields.join(',')}`);
          return Promise.resolve({} as never);
        },
        dismiss: (gameId: number) => {
          calls.push(`dismiss ${String(gameId)}`);
        },
      },
      geminiClient: {
        test: () => {
          calls.push('test');
          return Promise.resolve();
        },
      },
      geminiBatch: {
        start: () => {
          calls.push('batch.start');
          return Promise.resolve(IDLE_BATCH);
        },
        pause: () => IDLE_BATCH,
        resume: () => Promise.resolve(IDLE_BATCH),
        cancel: () => IDLE_BATCH,
        status: () => {
          calls.push('batch.status');
          return IDLE_BATCH;
        },
      },
    }),
  });
  return { handlers, secrets, calls };
}

describe('Gemini handlers (FR-SCR-7)', () => {
  it('FR-SCR-7: the key is stored in the secret store and reported only as set / not set', async () => {
    const { handlers, secrets } = setup();
    expect(await handlers['gemini.key.status']()).toEqual({ available: true, set: false });
    expect(await handlers['gemini.key.set']({ apiKey: 'AIza-secret-key' })).toEqual({
      available: true,
      set: true,
    });
    expect(await secrets.get('gemini.apiKey')).toBe('AIza-secret-key');
    expect(await handlers['gemini.key.set']({ apiKey: null })).toEqual({
      available: true,
      set: false,
    });
    expect(await secrets.get('gemini.apiKey')).toBeNull();
  });

  it('FR-SCR-7: ask, stored, apply, dismiss and test reach the library services', async () => {
    const { handlers, calls } = setup();
    await handlers['gemini.ask']({ gameId: 3, allFields: true });
    await handlers['gemini.stored']({ gameId: 3 });
    await handlers['gemini.apply']({ gameId: 3, fields: ['year', 'title'] });
    await handlers['gemini.dismiss']({ gameId: 3 });
    expect(await handlers['gemini.test']()).toEqual({ ok: true });
    expect(calls).toEqual(['ask 3 true', 'stored 3', 'apply 3 year,title', 'dismiss 3', 'test']);
  });

  it('FR-SCR-7: the Gemini batch channels reach the Gemini batch', async () => {
    const { handlers, calls } = setup();
    await handlers['gemini.batch.start']({
      scope: { systemIds: ['coleco-telstar'] },
      rules: { fields: ['year'], mode: 'review', route: 'api' },
    });
    await handlers['gemini.batch.status']();
    expect(calls).toEqual(['batch.start', 'batch.status']);
  });
});
