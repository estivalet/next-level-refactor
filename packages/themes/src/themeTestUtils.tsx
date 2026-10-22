// Test-only helpers for theme components: render a theme on a FakeThemeHost with the engine and
// art providers around it, and press keys the way the input layer reads them.
import { fireEvent, render, screen, waitFor, type RenderResult } from '@testing-library/react';
import type { ComponentType } from 'react';
import { expect, vi, type Mock } from 'vitest';
import { ThemeArtProvider } from './engine/ThemeArtProvider.tsx';
import { ThemeEngineProvider } from './engine/ThemeEngineProvider.tsx';
import type { ThemeComponentProps, ThemeModule } from './engine/types.ts';
import { FakeThemeHost } from './host/FakeThemeHost.ts';

/** No art at all, so themes show their text fallbacks. */
export const NO_ART_FILES = { packFiles: [], assetsFiles: [], manifest: null, warnings: [] };

/** A full key press: actions fire on keydown, and a key counts again after its keyup. */
export function press(code: string, target: Element = document.activeElement ?? document.body) {
  fireEvent.keyDown(target, { code });
  fireEvent.keyUp(target, { code });
}

interface RenderThemeOptions {
  host?: FakeThemeHost;
  inputEnabled?: boolean;
  Component?: ComponentType<ThemeComponentProps>;
}

export function renderTheme(
  theme: ThemeModule,
  options: RenderThemeOptions = {},
): { host: FakeThemeHost; onExit: Mock<() => void>; view: RenderResult } {
  const {
    host = new FakeThemeHost({ art: NO_ART_FILES }),
    inputEnabled = true,
    Component = theme.Component,
  } = options;
  const onExit = vi.fn<() => void>();
  const view = render(
    <ThemeEngineProvider host={host} onExit={onExit}>
      <ThemeArtProvider host={host} themeId={theme.id} moduleArt={theme.art}>
        <Component onExit={onExit} inputEnabled={inputEnabled} />
      </ThemeArtProvider>
    </ThemeEngineProvider>,
  );
  return { host, onExit, view };
}

/** Waits until `text` is on screen (themes render asynchronously after the menu loads). */
export async function shows(text: string | RegExp) {
  await waitFor(() => {
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });
}
