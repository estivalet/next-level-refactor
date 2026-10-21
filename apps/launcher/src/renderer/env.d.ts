import type { NextLevelBridge } from '@nextlevel/shared';

declare global {
  interface Window {
    nextlevel?: NextLevelBridge;
  }
}
