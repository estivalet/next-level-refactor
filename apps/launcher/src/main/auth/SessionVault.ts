import { SessionRecordSchema, type SessionRecord } from '@nextlevel/shared';
import type { SecretsLike } from '../secrets/SecretStore.ts';

/**
 * The launcher's sign-in (`auth.session`, security §2): kept in memory, and in the OS store when
 * it is available. A store that fails stops remembering for this run; the session still works.
 */
export class SessionVault {
  readonly #secrets: SecretsLike;
  readonly #log: { warn(context: object, msg: string): void };
  #session: SessionRecord | null = null;
  #remembered = true;

  constructor(secrets: SecretsLike, log: { warn(context: object, msg: string): void }) {
    this.#secrets = secrets;
    this.#log = log;
  }

  current(): SessionRecord | null {
    return this.#session;
  }

  remembered(): boolean {
    return this.#remembered;
  }

  async load(): Promise<SessionRecord | null> {
    try {
      const raw = await this.#secrets.get('auth.session');
      const parsed = raw === null ? null : SessionRecordSchema.safeParse(JSON.parse(raw));
      this.#session = parsed?.success ? parsed.data : null;
    } catch {
      this.#session = null;
    }
    return this.#session;
  }

  /** A new sign-in asks the OS store again whether it can keep the session. */
  async probe(): Promise<void> {
    this.#remembered = await this.#secrets.available().catch(() => false);
  }

  async store(session: SessionRecord): Promise<void> {
    this.#session = session;
    if (!this.#remembered) return;
    try {
      await this.#secrets.setMany({ 'auth.session': JSON.stringify(session) });
    } catch (error) {
      this.#remembered = false;
      this.#log.warn({ code: (error as { code?: string }).code }, 'sign-in not remembered');
    }
  }

  async clear(): Promise<void> {
    this.#session = null;
    await this.#secrets.setMany({ 'auth.session': null }).catch(() => undefined);
  }
}
