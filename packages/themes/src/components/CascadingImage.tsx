// Ported from NextLevelOS src/components/CascadingImage.tsx @ 3d530b7.
import { useState, type ReactNode } from 'react';

/**
 * Tries each URL in `srcs` in order and moves to the next when one fails to load. When every URL
 * fails (or there is none) it renders `fallback`, or nothing.
 */
export function CascadingImage({
  srcs,
  alt,
  className,
  fallback,
  onSuccess,
}: {
  srcs: string[];
  alt: string;
  className?: string | undefined;
  fallback?: ReactNode;
  onSuccess?: (src: string) => void;
}) {
  // The position restarts when the list changes (e.g. another game got focus).
  const key = srcs.join('|');
  const [attempt, setAttempt] = useState({ key, index: 0 });
  const index = attempt.key === key ? attempt.index : 0;
  const src = srcs[index];

  if (src === undefined) return fallback ? <>{fallback}</> : null;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      // Decode off the main thread so a cover sliding in doesn't stall the animation frame.
      decoding="async"
      onLoad={() => onSuccess?.(src)}
      onError={() => {
        setAttempt({ key, index: index + 1 });
      }}
    />
  );
}
