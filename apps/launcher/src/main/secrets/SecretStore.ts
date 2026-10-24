import { readFile } from 'node:fs/promises';
import { AppErrorException, ERROR_CODES } from '@nextlevel/shared';
import { atomicWrite } from '../fs/atomicWrite.ts';

/**
 * The OS encryption the store uses (Electron's async `safeStorage`, DPAPI on Windows).
 * `reEncrypt` = the key was rotated, so the data should be written again.
 */
export interface Cipher {
  available(): Promise<boolean>;
  encrypt(text: string): Promise<Buffer>;
  decrypt(data: Buffer): Promise<{ text: string; reEncrypt: boolean }>;
}

export type SecretKey =
  | 'screenscraper.devId'
  | 'screenscraper.devPassword'
  | 'screenscraper.user'
  | 'screenscraper.password';

/** What callers need from the store; tests use `memorySecrets()` (secrets/testing.ts). */
export type SecretsLike = Pick<SecretStore, 'available' | 'get' | 'has' | 'setMany'>;

type SecretMap = Partial<Record<SecretKey, string>>;

/**
 * Secrets kept out of settings, backups and logs (data model §2.2, FR-SCR-3): one encrypted JSON
 * map in `secrets.bin`, written atomically. An unreadable file reads as empty; values never
 * appear in a log line.
 */
export class SecretStore {
  private cache: SecretMap | null = null;

  constructor(
    private readonly file: string,
    private readonly cipher: Cipher,
    private readonly log: { warn(context: object, msg: string): void },
  ) {}

  available(): Promise<boolean> {
    return this.cipher.available();
  }

  async get(key: SecretKey): Promise<string | null> {
    return (await this.read())[key] ?? null;
  }

  async has(key: SecretKey): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  /** Sets the given keys (`null` removes one) in one write. */
  async setMany(values: Partial<Record<SecretKey, string | null>>): Promise<void> {
    if (!(await this.cipher.available())) {
      throw new AppErrorException({
        code: 'SECRETS_UNAVAILABLE',
        message: ERROR_CODES.SECRETS_UNAVAILABLE,
      });
    }
    const current = Object.entries(await this.read()).filter(([key]) => !(key in values));
    const added = Object.entries(values).filter(([, value]) => value !== null);
    await this.write(Object.fromEntries([...current, ...added]));
  }

  private async write(map: SecretMap): Promise<void> {
    await atomicWrite(this.file, await this.cipher.encrypt(JSON.stringify(map)));
    this.cache = map;
  }

  private async read(): Promise<SecretMap> {
    if (this.cache) return this.cache;
    if (!(await this.cipher.available())) return {};
    let data: Buffer;
    try {
      data = await readFile(this.file);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') this.log.warn({ code }, 'secrets file unreadable');
      return (this.cache = {});
    }
    let decrypted: { text: string; reEncrypt: boolean };
    let map: SecretMap = {};
    try {
      decrypted = await this.cipher.decrypt(data);
      const parsed: unknown = JSON.parse(decrypted.text);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        map = Object.fromEntries(
          Object.entries(parsed).filter(([, value]) => typeof value === 'string'),
        );
      }
    } catch {
      this.log.warn({}, 'secrets file could not be decrypted; starting empty');
      return (this.cache = {});
    }
    if (decrypted.reEncrypt) await this.write(map);
    return (this.cache = map);
  }
}
