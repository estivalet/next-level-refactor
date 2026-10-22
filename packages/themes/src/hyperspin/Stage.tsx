// Ported from NextLevelOS src/themes/hyperspin/Stage.tsx @ 3d530b7.
import { useState } from 'react';
import { AnimatedLayer } from '../components/AnimatedLayer.tsx';
import { CascadingImage } from '../components/CascadingImage.tsx';
import { LevelLogo } from '../components/LevelLogo.tsx';
import type { ArtEntranceName } from '../engine/artEntrances.ts';

/** What the stage shows for the settled wheel item. `box` is null for menu items. */
export interface StageItem {
  /** Play key: changing it replays the entrances. */
  key: string;
  title: string;
  logo: string[];
  frameVideo: string[];
  frameImage: string[];
  box: string[] | null;
}

const LOGO_POOL: ArtEntranceName[] = ['drop', 'zoom-in', 'spin-in'];
const FRAME_POOL: ArtEntranceName[] = ['zoom-rotate', 'flip-x', 'zoom-in'];
const BOX_POOL: ArtEntranceName[] = ['slide-left', 'slide-right', 'bounce'];
const COUNT_POOL: ArtEntranceName[] = ['slide-up'];
const FLASH_POOL: ArtEntranceName[] = ['zoom-in'];

/** Video (muted, looping) falling through its candidates, then the image chain. */
function StageFrame({ video, image, title }: { video: string[]; image: string[]; title: string }) {
  const [videoIdx, setVideoIdx] = useState(0);
  const src = video[videoIdx];
  if (src !== undefined) {
    return (
      <video
        key={src}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="hs-frame-media"
        onError={() => {
          setVideoIdx((i) => i + 1);
        }}
      />
    );
  }
  return <CascadingImage srcs={image} alt={title} className="hs-frame-media" />;
}

export function Stage({
  item: stageItem,
  countText,
  flash,
  message,
  trail,
}: {
  item: StageItem | null;
  countText: string;
  flash: { letter: string; id: number } | null;
  message: string | null;
  trail: string;
}) {
  const item = message ? null : stageItem; // a message replaces the item
  return (
    <div className="hs-stage">
      {trail && <div className="hs-trail">{trail}</div>}
      {message && <div className="hs-message">{message}</div>}
      {/* Layers stay mounted and take a null key when empty, so the old content exits. */}
      <AnimatedLayer playKey={item?.key ?? null} pool={LOGO_POOL} className="hs-logo-layer">
        {item && <LevelLogo candidates={item.logo} fallbackText={item.title} className="hs-logo" />}
      </AnimatedLayer>
      <AnimatedLayer playKey={item?.key ?? null} pool={FRAME_POOL} className="hs-frame-layer">
        {item && (
          <StageFrame
            key={item.key}
            video={item.frameVideo}
            image={item.frameImage}
            title={item.title}
          />
        )}
      </AnimatedLayer>
      <AnimatedLayer playKey={item?.box ? item.key : null} pool={BOX_POOL} className="hs-box-layer">
        {item?.box && <CascadingImage srcs={item.box} alt="" className="hs-box" />}
      </AnimatedLayer>
      {/* Keyed on the item only: "…" → "N games" updates in place without replaying. */}
      <AnimatedLayer
        playKey={countText ? (item?.key ?? '') : null}
        pool={COUNT_POOL}
        className="hs-count-layer"
      >
        <div className="hs-count">{countText}</div>
      </AnimatedLayer>
      <AnimatedLayer
        playKey={flash ? `flash-${String(flash.id)}` : null}
        pool={FLASH_POOL}
        className="hs-letter-layer"
      >
        {flash && <div className="hs-letter">{flash.letter}</div>}
      </AnimatedLayer>
    </div>
  );
}
