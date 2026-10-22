// Ported from NextLevelOS src/themes/components/Background.tsx @ 3d530b7 (callers pass layers; the
// legacy candidate props are gone).
import './background.css';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { bgCrossfade } from '../engine/transitions.ts';
import type { BackgroundLayer } from '../engine/types.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';
import { CascadingImage } from './CascadingImage.tsx';
import { cn } from './cn.ts';

/** A video that moves to its next candidate on error and renders nothing once all failed. */
function VideoLayer({ candidates, onLoaded }: { candidates: string[]; onLoaded: () => void }) {
  const key = candidates.join('|');
  const [attempt, setAttempt] = useState({ key, index: 0 });
  const index = attempt.key === key ? attempt.index : 0;
  const src = candidates[index];
  if (src === undefined) return null;
  return (
    <video
      key={src}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 h-full w-full object-cover"
      onCanPlay={onLoaded}
      onError={() => {
        setAttempt({ key, index: index + 1 });
      }}
    />
  );
}

/**
 * Full-screen background from ordered sources, highest priority first. Each source falls
 * through its own candidates; the first that loads wins and the sources below it unmount (no
 * video decoding behind an opaque fanart). Still images zoom slowly unless the theme's
 * `art.backgroundZoom` (or `zoom`) is false.
 */
export function Background({
  layers,
  overlay,
  className,
  zoom,
  paused = false,
}: {
  layers: BackgroundLayer[];
  overlay?: ReactNode;
  className?: string;
  zoom?: boolean;
  /** Drops video layers (nothing decodes while the theme is out of sight or a game runs). */
  paused?: boolean;
}) {
  const { config } = useThemeArt();
  const zoomStills = zoom ?? config.backgroundZoom !== false;
  const resolved = layers.filter(
    (layer) => layer.candidates.length > 0 && !(paused && layer.kind === 'video'),
  );
  const sig = resolved.map((layer) => layer.candidates[0]).join('~') || 'empty';

  // The highest-priority layer that painted, for this set of sources.
  const [loaded, setLoaded] = useState<{ sig: string; index: number } | null>(null);
  const loadedIndex = loaded?.sig === sig ? loaded.index : null;
  const markLoaded = (index: number) => {
    setLoaded((prev) => (prev?.sig === sig && prev.index <= index ? prev : { sig, index }));
  };

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      <AnimatePresence>
        <motion.div
          key={sig}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={bgCrossfade}
        >
          {resolved
            .map((layer, index) => ({ layer, index }))
            .filter(({ index }) => loadedIndex === null || index <= loadedIndex)
            // The highest-priority source is the last child, so it paints on top. Stacking is
            // DOM order only: a z-index would escape this layer and cover the theme above it.
            .reverse()
            .map(({ layer, index }) => (
              <div
                key={`${String(index)}:${layer.candidates[0] ?? ''}`}
                className="absolute inset-0"
              >
                {layer.kind === 'image' ? (
                  <CascadingImage
                    srcs={layer.candidates}
                    alt=""
                    className={cn(
                      'absolute inset-0 h-full w-full object-cover',
                      zoomStills && 'nl-bg-zoom',
                    )}
                    onSuccess={() => {
                      markLoaded(index);
                    }}
                  />
                ) : (
                  <VideoLayer
                    candidates={layer.candidates}
                    onLoaded={() => {
                      markLoaded(index);
                    }}
                  />
                )}
              </div>
            ))}
        </motion.div>
      </AnimatePresence>
      {overlay}
    </div>
  );
}
