// Cases ported from NextLevelOS src/themes/hyperspin/HyperspinTheme.test.tsx @ 3d530b7 on a
// FakeThemeHost, driven by input actions (US-C1). Settings, pointer art and filter layout cases
// are in HyperspinTheme.settings.test.tsx.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useNavigationSound } from '../components/useNavigationSound.ts';
import { ThemeArtProvider } from '../engine/ThemeArtProvider.tsx';
import { ThemeEngineProvider } from '../engine/ThemeEngineProvider.tsx';
import { useThemeNavigation } from '../engine/useThemeNavigation.ts';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { NO_ART_FILES, press } from '../themeTestUtils.tsx';
import { HyperspinTheme } from './HyperspinTheme.tsx';
import { hyperspinTheme } from './index.ts';
import {
  atRoot,
  filterLabel,
  filterPos,
  focusedLabel,
  mountHyperspin,
  openSolo,
} from './testUtils.tsx';

vi.mock('../components/useNavigationSound.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/useNavigationSound.ts')>()),
  useNavigationSound: vi.fn(),
}));

const lastSound = () => vi.mocked(useNavigationSound).mock.calls.at(-1)?.[0];

describe('HyperSpin Classic (FR-THM-1)', () => {
  it('shows the root items on the wheel; up/down wrap', async () => {
    mountHyperspin();
    await atRoot();
    press('ArrowUp');
    expect(focusedLabel()).toBe('Solo');
    press('ArrowDown');
    expect(focusedLabel()).toBe('Nintendo');
  });

  it('select drills in, back goes back, back at the root exits', async () => {
    const { onExit } = mountHyperspin();
    await atRoot();
    press('Enter');
    await waitFor(() => {
      expect(focusedLabel()).toBe('Super Nintendo');
    });
    press('Escape');
    await atRoot();
    expect(onExit).not.toHaveBeenCalled();
    press('Escape');
    expect(onExit).toHaveBeenCalled();
  });

  it('a system opens the games wheel without hidden games; down wraps', async () => {
    mountHyperspin();
    await openSolo();
    expect(filterLabel()).toBe('All');
    expect(filterPos()).toBe('1/3');
    expect(screen.getAllByText('5 games').length).toBeGreaterThan(0);
    press('ArrowUp');
    expect(focusedLabel()).toBe('Bravo');
    press('ArrowDown');
    expect(focusedLabel()).toBe('1942');
  });

  it('left/right jump between starting letters with a letter flash', async () => {
    mountHyperspin();
    await openSolo();
    press('ArrowRight');
    expect(focusedLabel()).toBe('Alpha');
    expect(document.querySelector('.hs-letter')?.textContent).toBe('A');
    press('ArrowRight');
    expect(focusedLabel()).toBe('Beta');
    press('ArrowDown');
    expect(focusedLabel()).toBe('Bravo');
    press('ArrowLeft');
    expect(focusedLabel()).toBe('Beta');
    press('ArrowRight');
    expect(focusedLabel()).toBe('1942');
  });

  it('D5: LT/RT (PageUp/PageDown) jump by letter too', async () => {
    mountHyperspin();
    await openSolo();
    press('PageDown');
    expect(focusedLabel()).toBe('Alpha');
    press('PageUp');
    expect(focusedLabel()).toBe('1942');
  });

  it('LB/RB (Q/E) cycle the filters and the wheel follows', async () => {
    mountHyperspin();
    await openSolo();
    press('KeyE');
    expect(filterLabel()).toBe('Favorites');
    await waitFor(() => {
      expect(focusedLabel()).toBe('Beta');
    });
    press('KeyE');
    await waitFor(() => {
      expect(focusedLabel()).toBe('Gamma');
    });
    press('KeyE');
    expect(filterLabel()).toBe('All');
    press('KeyQ');
    expect(filterLabel()).toBe('Hidden');
  });

  it('an empty filter shows No games and keeps the label', async () => {
    mountHyperspin();
    await atRoot();
    press('Enter'); // Nintendo
    await waitFor(() => {
      expect(focusedLabel()).toBe('Super Nintendo');
    });
    press('ArrowDown');
    press('Enter'); // Nintendo 64: nothing hidden
    await waitFor(() => {
      expect(focusedLabel()).toBe('N64 A');
    });
    press('KeyQ');
    expect(filterLabel()).toBe('Hidden');
    await screen.findByText('No games');
    expect(document.querySelector('[data-wheel] [data-slot]')).toBeNull();
  });

  it('random focuses a different game', async () => {
    mountHyperspin();
    await openSolo();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    press('KeyR');
    expect(focusedLabel()).toBe('Alpha');
    vi.restoreAllMocks();
  });

  it('the stage waits for the focus to settle', async () => {
    mountHyperspin();
    await openSolo();
    await waitFor(() => {
      expect(document.querySelector('[data-play-key$=":901"]')).not.toBeNull();
    });
    press('ArrowDown');
    press('ArrowDown');
    press('ArrowDown'); // Beta
    expect(document.querySelector('[data-play-key$=":902"]')).toBeNull();
    expect(document.querySelector('[data-play-key$=":904"]')).toBeNull();
    await waitFor(() => {
      expect(document.querySelector('[data-play-key$=":904"]')).not.toBeNull();
    });
    expect(document.querySelector('[data-play-key$=":902"]')).toBeNull();
  });

  it('the count describes the settled menu item, not the focused one', async () => {
    mountHyperspin();
    await screen.findByText('2 items');
    press('ArrowUp');
    press('ArrowUp'); // Collections, not settled yet
    expect(screen.queryByText('1 item')).toBeNull();
    await screen.findByText('1 item');
  });

  it('search opens on the games wheel; back closes it without leaving', async () => {
    const { onExit } = mountHyperspin();
    await openSolo();
    press('KeyF');
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'Bra' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(focusedLabel()).toBe('Bravo');
    });
    press('Escape');
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(onExit).not.toHaveBeenCalled();
    expect(focusedLabel()).toBe('Bravo');
  });

  it('help opens the controls; Start opens the theme menu', async () => {
    const { onExit } = mountHyperspin();
    await atRoot();
    press('F1');
    expect(screen.getByRole('dialog', { name: 'Controls' })).toBeInTheDocument();
    press('Escape');
    press('Tab');
    expect(onExit).toHaveBeenCalled();
  });

  it('keeps the place when mounted below the root (theme switch)', async () => {
    function Switcher() {
      const nav = useThemeNavigation();
      const [on, setOn] = useState(false);
      if (on) return <HyperspinTheme onExit={() => undefined} />;
      return (
        <div>
          <span data-testid="depth">{nav.state.stack.length}</span>
          <button
            type="button"
            onClick={() => {
              nav.enter(1);
            }}
          >
            in1
          </button>
          <button
            type="button"
            onClick={() => {
              setOn(true);
            }}
          >
            go
          </button>
        </div>
      );
    }
    const host = new FakeThemeHost({ art: NO_ART_FILES });
    render(
      <ThemeEngineProvider host={host} onExit={() => undefined}>
        <ThemeArtProvider host={host} themeId="hyperspin" moduleArt={hyperspinTheme.art}>
          <Switcher />
        </ThemeArtProvider>
      </ThemeEngineProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('depth').textContent).toBe('1');
    });
    fireEvent.click(screen.getByText('in1')); // Sega
    await waitFor(() => {
      expect(screen.getByTestId('depth').textContent).toBe('2');
    });
    fireEvent.click(screen.getByText('go'));
    await waitFor(() => {
      expect(focusedLabel()).toBe('Sega Genesis');
    });
  });

  it('navigation sound: wheel moves play, entering a level or a filter is a level change', async () => {
    vi.mocked(useNavigationSound).mockClear();
    mountHyperspin();
    await atRoot();
    expect(lastSound()).toMatchObject({ levelKind: 'menu', focusKey: 0, muted: false });
    const menuLevel = lastSound()?.levelKey;
    press('ArrowDown');
    expect(lastSound()).toMatchObject({ focusKey: 1, levelKey: menuLevel });
    press('ArrowUp');
    press('ArrowUp'); // Solo
    press('Enter');
    await waitFor(() => {
      expect(focusedLabel()).toBe('1942');
    });
    expect(lastSound()?.levelKind).toBe('games');
    const gamesLevel = lastSound()?.levelKey;
    expect(gamesLevel).not.toBe(menuLevel);
    press('ArrowDown');
    expect(lastSound()).toMatchObject({ focusKey: 1, levelKey: gamesLevel });
    press('KeyE');
    await waitFor(() => {
      expect(lastSound()?.levelKey).not.toBe(gamesLevel);
    });
  });
});
