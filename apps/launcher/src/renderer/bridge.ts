import { ERROR_CODES, err, type NextLevelBridge } from '@nextlevel/shared';

// When the preload failed to load, calls resolve an error instead of crashing the UI.
const missingBridge: NextLevelBridge = {
  invoke: () =>
    Promise.resolve(err('INTERNAL', ERROR_CODES.INTERNAL, { reason: 'bridge unavailable' })),
  on: () => () => undefined,
};

let testBridge: NextLevelBridge | null = null;

/** The typed bridge to main. Feature `api.ts` hooks use this; components never touch it. */
export function getBridge(): NextLevelBridge {
  return testBridge ?? window.nextlevel ?? missingBridge;
}

/** Test-only: replace the bridge; `null` restores the default lookup. */
export function setBridgeForTests(bridge: NextLevelBridge | null): void {
  testBridge = bridge;
}
