const ZONE = 'America/Los_Angeles';

/** The wall-clock parts of `at` in Los Angeles. */
function laParts(at: Date): { year: number; month: number; day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    minutes: get('hour') * 60 + get('minute'),
  };
}

/** Los Angeles' UTC offset at `at`, in minutes (−480 in winter, −420 in summer). */
function laOffset(at: Date): number {
  const { year, month, day, minutes } = laParts(at);
  const wall = Date.UTC(year, month - 1, day) + minutes * 60_000;
  return Math.round((wall - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/**
 * When Gemini's free daily limit resets (FR-SCR-7): the next 00:00 in Los Angeles, Google's
 * reset time for the free tier, across daylight saving changes.
 */
export function nextQuotaReset(now: Date): Date {
  const { year, month, day } = laParts(now);
  const midnightWall = Date.UTC(year, month - 1, day + 1);
  // Guess with today's offset, then correct with the offset at the guess (DST change days).
  const guess = midnightWall - laOffset(now) * 60_000;
  return new Date(midnightWall - laOffset(new Date(guess)) * 60_000);
}
