import type { CredentialStatus } from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';
import type { SecretKey, SecretStore } from '../secrets/SecretStore.ts';

type CredentialChannel = Extract<keyof IpcHandlers, `scraper.credentials.${string}`>;

/** The input field each secret key is set from (contract `scraper.credentials.set`). */
const FIELDS = {
  devId: 'screenscraper.devId',
  devPassword: 'screenscraper.devPassword',
  user: 'screenscraper.user',
  password: 'screenscraper.password',
} as const satisfies Record<string, SecretKey>;

/** ScreenScraper credentials (FR-SCR-3, D15): written to the OS store, reported only as flags. */
export function createCredentialHandlers(deps: {
  secrets: Pick<SecretStore, 'available' | 'has' | 'setMany'>;
}): Pick<IpcHandlers, CredentialChannel> {
  const status = async (): Promise<CredentialStatus> => ({
    available: await deps.secrets.available(),
    devId: await deps.secrets.has(FIELDS.devId),
    devPassword: await deps.secrets.has(FIELDS.devPassword),
    user: await deps.secrets.has(FIELDS.user),
    password: await deps.secrets.has(FIELDS.password),
  });
  return {
    'scraper.credentials.status': status,
    'scraper.credentials.set': async (input) => {
      const changes: Partial<Record<SecretKey, string | null>> = {};
      for (const [field, key] of Object.entries(FIELDS) as Array<
        [keyof typeof FIELDS, SecretKey]
      >) {
        const value = input[field];
        if (value !== undefined) changes[key] = value;
      }
      await deps.secrets.setMany(changes);
      return status();
    },
  };
}
