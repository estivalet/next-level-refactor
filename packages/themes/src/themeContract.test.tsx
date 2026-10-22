// Port of NextLevelOS src/themes/registry.test.ts @ 3d530b7 "filter layout": the engine's stack
// survives theme switches, so a theme that does not declare its filter layout would show levels
// built by the previous theme's layout. Checked by rendering every theme, not by reading sources.
import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFilterLayout } from './engine/useFilterLayout.ts';
import { THEMES } from './registry.ts';
import { renderTheme } from './themeTestUtils.tsx';

vi.mock('./engine/useFilterLayout.ts', () => ({ useFilterLayout: vi.fn() }));
vi.mock('./components/useNavigationSound.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./components/useNavigationSound.ts')>()),
  useNavigationSound: vi.fn(),
}));

describe('theme contract (FR-THM-1)', () => {
  it.each(THEMES.map((theme) => [theme.id, theme] as const))(
    '%s declares how it shows filters (useFilterLayout)',
    async (_id, theme) => {
      vi.mocked(useFilterLayout).mockClear();
      const { view } = renderTheme(theme);
      await waitFor(() => {
        expect(vi.mocked(useFilterLayout)).toHaveBeenCalled();
      });
      for (const [filtersInMenu] of vi.mocked(useFilterLayout).mock.calls) {
        expect(typeof filtersInMenu).toBe('boolean');
      }
      view.unmount();
    },
  );
});
