import { useQuery } from '@tanstack/react-query';
import { getBridge } from '../../../bridge.ts';
import { unwrap, useSettings } from '../settingsApi.ts';

interface ArtFolders {
  assetsPath: string | null;
  themesPath: string | null;
}

/** Keyed by the art folders too: a changed folder (Settings, an import) is a different index. */
export const artIndexKey = (themeId: string, folders: ArtFolders) =>
  ['frontend.artIndex', themeId, folders.assetsPath, folders.themesPath] as const;

/**
 * The saved art folders (main reads art from these, not from an unsaved draft); null until the
 * settings have loaded.
 */
export function useArtFolders(): ArtFolders | null {
  const loaded = useSettings().data;
  if (!loaded) return null;
  const storage = loaded.kind === 'ok' ? loaded.snapshot.settings.storage : null;
  return { assetsPath: storage?.assetsPath ?? null, themesPath: storage?.themesPath ?? null };
}

const NO_FOLDERS: ArtFolders = { assetsPath: null, themesPath: null };

/** A theme's art index (pack and shared files, pack manifest), as the front-end sees it. */
export function useThemeArtIndex(themeId: string) {
  const folders = useArtFolders();
  return useQuery({
    queryKey: artIndexKey(themeId, folders ?? NO_FOLDERS),
    queryFn: async () => unwrap(await getBridge().invoke('frontend.artIndex', { themeId })),
    enabled: folders !== null,
  });
}
