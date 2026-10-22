// Ported from NextLevelOS src/themes/components/AnimatedLayer.tsx @ 3d530b7 (the pick is state
// adjusted during render instead of a memo with silenced dependencies).
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { ART_ENTRANCES, pickEntrance, type ArtEntranceName } from '../engine/artEntrances.ts';

const EXIT = { opacity: 0, scale: 0.96, transition: { duration: 0.15 } };

const choose = (pool: ArtEntranceName[], reduce: boolean): ArtEntranceName =>
  reduce ? 'fade' : pickEntrance(pool, Math.random);

/**
 * Plays a random entrance from `pool` each time `playKey` changes; the previous content exits
 * with a quick fade. A null `playKey` renders nothing, so the current content exits (keep the
 * layer mounted to get that exit). Reduced motion always fades. Position the layer with
 * `className` (old and new content overlap during the exit).
 */
export function AnimatedLayer({
  playKey,
  pool,
  className,
  children,
}: {
  playKey: string | null;
  pool: ArtEntranceName[];
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion() ?? false;
  // One pick per playKey (the pool is fixed per call site).
  const [pick, setPick] = useState(() => ({ playKey, reduce, name: choose(pool, reduce) }));
  let name = pick.name;
  if (pick.playKey !== playKey || pick.reduce !== reduce) {
    name = choose(pool, reduce);
    setPick({ playKey, reduce, name });
  }
  const entrance = ART_ENTRANCES[name];
  return (
    <AnimatePresence>
      {playKey !== null && (
        <motion.div
          key={playKey}
          data-play-key={playKey}
          data-entrance={name}
          className={className}
          initial={entrance.initial}
          animate={entrance.animate}
          transition={entrance.transition}
          exit={EXIT}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
