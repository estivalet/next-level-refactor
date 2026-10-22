// Ported from NextLevelOS src/themes/engine/transitions.ts @ 3d530b7.
/**
 * Named `motion` transition presets shared across theme components.
 * Each value is a plain object usable directly as a `motion` `transition` prop.
 */

export const carouselSlide = { type: 'spring', stiffness: 300, damping: 34 } as const;
export const levelPush = { type: 'spring', stiffness: 260, damping: 30 } as const;
export const levelPop = { type: 'spring', stiffness: 260, damping: 30 } as const;
export const bgCrossfade = { duration: 0.4, ease: 'easeInOut' } as const;
export const logoIn = { duration: 0.25, ease: 'easeOut' } as const;
