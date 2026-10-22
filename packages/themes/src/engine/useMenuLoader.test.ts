import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { FIXTURE_MENU } from '../host/fixtures.ts';
import { navReducer, initialEngineState } from './navReducer.ts';
import { useMenuLoader } from './useMenuLoader.ts';

describe('useMenuLoader (US-D5)', () => {
  it('a reload never cancels the games load of a level that is not rendered yet', async () => {
    // The ref still shows the root menu: the user just opened a system and React has not
    // committed it, so a games load is in flight that the ref can't see.
    const committed = navReducer(initialEngineState(), {
      type: 'menu-loaded',
      items: FIXTURE_MENU.items,
      title: FIXTURE_MENU.title,
    });
    const stateRef = { current: committed };
    const dispatch = vi.fn();
    const loadGames = vi.fn();
    const { result } = renderHook(() =>
      useMenuLoader(new FakeThemeHost(), stateRef, dispatch, loadGames),
    );
    act(() => {
      result.current.reloadMenu();
    });
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'menu-reloaded' }));
    });
    // Nothing to refresh as far as the ref knows, and nothing cancelled either.
    expect(loadGames).not.toHaveBeenCalled();
  });
});
