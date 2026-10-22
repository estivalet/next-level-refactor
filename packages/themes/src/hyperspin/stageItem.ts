// What HyperSpin's stage shows for the settled wheel item, from the art index (FR-THM-2).
import type { MenuNode, ThemeGame } from '@nextlevel/shared';
import { backgroundImagePaths, SCREENSHOT_KINDS, videoPaths } from '../engine/themeArt.ts';
import type { ThemeArtApi } from '../engine/useThemeArt.ts';
import type { StageItem } from './Stage.tsx';

const present = (urls: Array<string | null>): string[] =>
  urls.filter((url): url is string => url !== null);

/** A menu item: its logo, its video, then its background art in the frame; no box. */
export function menuStageItem(
  art: ThemeArtApi,
  key: string,
  node: MenuNode,
  title: string,
): StageItem {
  return {
    key,
    title,
    logo: art.logo(node.name),
    frameVideo: art.urls(videoPaths(node.name, art.config)),
    frameImage: art.urls(backgroundImagePaths(node.name, art.config)),
    box: null,
  };
}

/** A game: its clear logo, its video (with video backgrounds on) or screenshots, its tile art. */
export function gameStageItem(art: ThemeArtApi, key: string, game: ThemeGame): StageItem {
  return {
    key,
    title: game.title,
    logo: present([art.gameMedia(game, 'logo-clear')]),
    frameVideo: art.config.useVideoBackground ? present([art.gameMedia(game, 'video')]) : [],
    frameImage: present(SCREENSHOT_KINDS.map((kind) => art.gameMedia(game, kind))),
    box: art.gameTile(game),
  };
}
