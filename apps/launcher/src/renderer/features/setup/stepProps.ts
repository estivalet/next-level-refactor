import type { Settings } from '@nextlevel/shared';

/** What every wizard step gets: the saved settings, a save, and moving on. */
export interface StepProps {
  settings: Settings;
  persist: (next: Settings) => Promise<unknown>;
  next: () => void;
}

export const NEXT_BUTTON =
  'rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50';
