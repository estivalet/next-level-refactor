import { positiveInt, type SsUser } from './types.ts';

export interface QuotaState {
  requestsToday: number | null;
  maxPerDay: number | null;
  /** ISO time the daily quota resets after a 430, or null. */
  exhaustedUntil: string | null;
}

/** ScreenScraper counts days in Paris time; the next midnight there, as an ISO time. */
export function nextParisMidnight(now: number): string {
  const offsetAt = (time: number): number => {
    const name = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris',
      timeZoneName: 'longOffset',
    })
      .formatToParts(new Date(time))
      .find((part) => part.type === 'timeZoneName')?.value;
    const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? '');
    if (!match) return 0;
    const minutes = Number(match[2]) * 60 + Number(match[3]);
    return (match[1] === '-' ? -minutes : minutes) * 60_000;
  };
  const day = new Date(now + offsetAt(now));
  const nextDay = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1);
  // The offset can change overnight (summer time), so take it at midnight itself.
  const guess = nextDay - offsetAt(nextDay - offsetAt(now));
  return new Date(nextDay - offsetAt(guess)).toISOString();
}

/**
 * Keeps requests within the account's limits (FR-SCR-2): at most `maxthreads` at once and starts
 * spaced by `minIntervalMs` (1.2 s, or 60 s / `maxrequestspermin`). Limits and daily counts come
 * from every response's `ssuser`.
 */
export class QuotaGate {
  private maxThreads = 1;
  private intervalMs: number;
  private active = 0;
  private nextStart = 0;
  private readonly waiting: Array<() => void> = [];
  private counts: Pick<QuotaState, 'requestsToday' | 'maxPerDay'> = {
    requestsToday: null,
    maxPerDay: null,
  };
  private resetAt: string | null = null;

  constructor(
    private readonly deps: {
      clock: () => number;
      sleep: (ms: number) => Promise<void>;
      minIntervalMs?: number;
    },
  ) {
    this.intervalMs = deps.minIntervalMs ?? 1200;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxThreads) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active += 1;
    try {
      const now = this.deps.clock();
      const start = Math.max(now, this.nextStart);
      this.nextStart = start + this.intervalMs;
      if (start > now) await this.deps.sleep(start - now);
      return await fn();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }

  update(user: SsUser): void {
    const threads = positiveInt(user.maxthreads);
    if (threads !== null) this.maxThreads = threads;
    const perMinute = positiveInt(user.maxrequestspermin);
    if (perMinute !== null) this.intervalMs = Math.ceil(60_000 / perMinute);
    const today = Number(user.requeststoday);
    if (user.requeststoday !== undefined && Number.isInteger(today) && today >= 0) {
      this.counts.requestsToday = today;
    }
    const perDay = positiveInt(user.maxrequestsperday);
    if (perDay !== null) this.counts.maxPerDay = perDay;
  }

  /** The daily quota ran out (HTTP 430/431): remember when it resets. */
  exhausted(): void {
    this.resetAt = nextParisMidnight(this.deps.clock());
  }

  state(): QuotaState {
    const resetAt =
      this.resetAt !== null && Date.parse(this.resetAt) > this.deps.clock() ? this.resetAt : null;
    return { ...this.counts, exhaustedUntil: resetAt };
  }
}
