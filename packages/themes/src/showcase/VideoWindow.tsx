// Ported from NextLevelOS src/themes/showcase/VideoWindow.tsx @ 3d530b7 (the position restarts
// with the list during render instead of in an effect).
import { useState } from 'react';

/**
 * Framed, muted, looping preview of the focused game's video. Steps through `candidates` on error
 * and renders nothing once every one has failed (or there are none). The frame stays invisible
 * until the video can play, so a missing file never flashes an empty box.
 */
export function VideoWindow({ candidates }: { candidates: string[] }) {
  const key = candidates.join('\n');
  const [state, setState] = useState({ key, index: 0, ready: false });
  const current = state.key === key ? state : { key, index: 0, ready: false };
  const src = candidates[current.index];
  if (src === undefined) return null;
  return (
    <div className="sc-video" data-ready={current.ready ? 'true' : undefined}>
      <video
        key={src}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="sc-video-el"
        onCanPlay={() => {
          setState({ ...current, ready: true });
        }}
        onError={() => {
          setState({ key, index: current.index + 1, ready: false });
        }}
      />
    </div>
  );
}
