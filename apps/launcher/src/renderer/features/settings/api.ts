import { useQuery } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';

/** The launcher version from main (`app.version`). */
export function useAppVersion() {
  return useQuery({
    queryKey: ['app.version'],
    queryFn: async () => {
      const result = await getBridge().invoke('app.version');
      if (!result.ok) throw new Error(result.error.code);
      return result.value;
    },
    retry: false,
    staleTime: Infinity,
  });
}
