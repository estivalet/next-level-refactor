import type { ArtIndex, ThemeArtOptions } from '@nextlevel/shared';
import {
  collectMenuNames,
  computeCoverage,
  mergeThemeArt,
  type ThemeCoverage,
  type ThemeModule,
} from '@nextlevel/themes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../../bridge.ts';
import { markArtRescanned } from '../../frontend/themeArtSession.ts';
import { unwrap } from '../settingsApi.ts';
import { artIndexKey, useArtFolders, useThemeArtIndex } from './useThemeArtIndex.ts';

export interface ThemeCoverageInfo {
  status: 'loading' | 'ready';
  /** The pack folder has a file or a valid theme.json. */
  hasPack: boolean;
  coverage: ThemeCoverage | null;
  index: ArtIndex | undefined;
}

/** The generated menu the front-end shows, for the names coverage counts. */
function useFrontendMenu() {
  return useQuery({
    queryKey: ['frontend.menu'],
    queryFn: async () => unwrap(await getBridge().invoke('frontend.menu')),
  });
}

/**
 * How much of a theme's menu art its pack covers (FR-THM-2), with the art config the running
 * theme would use (module, pack, the user's options in the draft).
 */
export function useThemeCoverage(
  theme: ThemeModule,
  userArt: ThemeArtOptions | undefined,
): ThemeCoverageInfo {
  const index = useThemeArtIndex(theme.id).data;
  const menu = useFrontendMenu();
  if (!index || menu.isPending) return { status: 'loading', hasPack: false, coverage: null, index };
  const names = menu.data ? collectMenuNames(menu.data.items) : [];
  const art = mergeThemeArt(theme.art, index.manifest?.art, userArt);
  return {
    status: 'ready',
    // A pack may hold only theme.json (options, or fallback: false) and still be a pack.
    hasPack: index.packFiles.length > 0 || index.manifest !== null,
    coverage: computeCoverage(names, art, index.packFiles),
    index,
  };
}

/** Rescan art: main reads the folders again; Settings and an open theme use the new index. */
export function useRescanArt(themeId: string) {
  const client = useQueryClient();
  const folders = useArtFolders();
  return async () => {
    const index = unwrap(await getBridge().invoke('frontend.artIndex', { themeId, refresh: true }));
    if (folders) client.setQueryData(artIndexKey(themeId, folders), index);
    markArtRescanned(themeId);
  };
}
