import type { SecretKey, SecretsLike } from './SecretStore.ts';

/** An in-memory secret store for tests; `values` is the backing map. */
export function memorySecrets(
  initial: Partial<Record<SecretKey, string>> = {},
  available = true,
): SecretsLike & { values: Map<SecretKey, string> } {
  const values = new Map<SecretKey, string>(Object.entries(initial) as Array<[SecretKey, string]>);
  return {
    values,
    available: () => Promise.resolve(available),
    get: (key) => Promise.resolve(values.get(key) ?? null),
    has: (key) => Promise.resolve(values.has(key)),
    setMany: (next) => {
      for (const [key, value] of Object.entries(next) as Array<[SecretKey, string | null]>) {
        if (value === null) values.delete(key);
        else values.set(key, value);
      }
      return Promise.resolve();
    },
  };
}
