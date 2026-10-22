// Ported from NextLevelOS src/themes/engine/artEntrances.ts @ 3d530b7.
import type { TargetAndTransition, Transition } from 'motion/react';

/**
 * Named entrance animations for theme artwork (HyperSpin-style fly-ins).
 * Each entry is a `motion` `initial` pose that animates to the neutral pose.
 */
export type ArtEntranceName =
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'drop'
  | 'zoom-in'
  | 'zoom-rotate'
  | 'spin-in'
  | 'flip-x'
  | 'bounce'
  | 'fade';

export interface ArtEntrance {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  transition: Transition;
}

const NEUTRAL = { x: 0, y: 0, scale: 1, rotate: 0, rotateY: 0, opacity: 1 };
const spring = (stiffness: number, damping: number): Transition => ({
  type: 'spring',
  stiffness,
  damping,
});

const entry = (initial: TargetAndTransition, transition: Transition): ArtEntrance => ({
  initial,
  animate: NEUTRAL,
  transition,
});

export const ART_ENTRANCES: Record<ArtEntranceName, ArtEntrance> = {
  'slide-left': entry({ x: '-120%', opacity: 0 }, spring(220, 26)),
  'slide-right': entry({ x: '120%', opacity: 0 }, spring(220, 26)),
  'slide-up': entry({ y: '80%', opacity: 0 }, spring(220, 26)),
  drop: entry({ y: '-140%' }, spring(300, 18)),
  'zoom-in': entry({ scale: 0.2, opacity: 0 }, { duration: 0.35, ease: 'easeOut' }),
  'zoom-rotate': entry({ scale: 0.3, rotate: -25, opacity: 0 }, spring(200, 20)),
  'spin-in': entry({ scale: 0, rotate: 360 }, { duration: 0.5, ease: 'easeOut' }),
  'flip-x': entry({ rotateY: 90, opacity: 0 }, { duration: 0.4, ease: 'easeOut' }),
  bounce: entry({ y: '-60%', scale: 0.8, opacity: 0 }, spring(400, 12)),
  fade: entry({ opacity: 0 }, { duration: 0.3 }),
};

export const ART_ENTRANCE_NAMES = Object.keys(ART_ENTRANCES) as ArtEntranceName[];

/** A uniformly random name from `pool` (`rand` in [0, 1)); `fade` for an empty pool. */
export function pickEntrance(pool: ArtEntranceName[], rand: () => number): ArtEntranceName {
  if (pool.length === 0) return 'fade';
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))] ?? 'fade';
}
