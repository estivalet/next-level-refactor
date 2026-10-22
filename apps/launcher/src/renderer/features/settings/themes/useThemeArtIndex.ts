import { useQuery } from '@tanstack/react-query';
import { getBridge } from '../../../bridge.ts';
import { unwrap } from '../settingsApi.ts';

export const artIndexKey = (themeId: string) => ['frontend.artIndex', themeId] as const;

/** A theme's art index (pack and shared files, pack manifest), as the front-end sees it. */
export function useThemeArtIndex(themeId: string) {
  return useQuery({
    queryKey: artIndexKey(themeId),
    queryFn: async () => unwrap(await getBridge().invoke('frontend.artIndex', { themeId })),
  });
}
