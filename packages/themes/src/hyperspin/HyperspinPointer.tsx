// Ported from NextLevelOS src/themes/hyperspin/HyperspinPointer.tsx @ 3d530b7: the candidates come
// from the art index (files that exist), so the first one is the art and nothing probes images.
import { AnimatePresence, motion, useReducedMotion, type MotionStyle } from 'motion/react';

/**
 * The wheel pointer at the right edge, centered on the focused item: per-name art
 * (`pointer/<name>.png`, then `_default.png`) or, without any, the built-in glowing knob.
 * Crossfades only when the art itself changes, so stepping between items that share a pointer
 * (or the knob) does not blink.
 */
export function HyperspinPointer({
  name,
  candidates,
  height,
}: {
  name: string;
  candidates: string[];
  height: number;
}) {
  const reduced = useReducedMotion();
  const src = candidates[0] ?? null;
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={src ?? 'knob'}
        data-pointer={name}
        aria-hidden="true"
        className="hs-pointer-slot"
        style={{ '--hs-pointer-height': `${String(height)}px` } as MotionStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.15 }}
      >
        {src ? <img src={src} alt="" className="hs-pointer-img" /> : <div className="hs-pointer" />}
      </motion.div>
    </AnimatePresence>
  );
}
