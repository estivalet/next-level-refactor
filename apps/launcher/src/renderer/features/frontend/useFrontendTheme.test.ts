import { defaultSettings, ok, type Settings } from '@nextlevel/shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge } from '../../test-utils.tsx';
import { useFrontendTheme } from './useFrontendTheme.ts';

afterEach(() => {
  setBridgeForTests(null);
});

const withLastUsed = (lastUsed: string | null): Settings => {
  const settings = defaultSettings();
  return { ...settings, themes: { ...settings.themes, lastUsed } };
};

describe('useFrontendTheme (FR-THM-1, FR-THM-5)', () => {
  it('a switch shows at once and is saved as lastUsed', () => {
    const bridge = installFakeBridge({ 'frontend.themeOpened': () => ok(undefined) });
    const { result } = renderHook(({ s }) => useFrontendTheme(s), {
      initialProps: { s: withLastUsed(null) },
    });
    expect(result.current.theme.id).toBe('big-box');
    act(() => {
      result.current.switchTo('ps5');
    });
    expect(result.current.theme.id).toBe('ps5');
    expect(bridge.calls).toContainEqual({
      channel: 'frontend.themeOpened',
      input: { themeId: 'ps5' },
    });
  });

  it('a later change in Settings wins over the switch', () => {
    installFakeBridge({ 'frontend.themeOpened': () => ok(undefined) });
    const { result, rerender } = renderHook(({ s }) => useFrontendTheme(s), {
      initialProps: { s: withLastUsed(null) },
    });
    act(() => {
      result.current.switchTo('ps5');
    });
    rerender({ s: withLastUsed('ps5') }); // the save arrives
    expect(result.current.theme.id).toBe('ps5');
    rerender({ s: withLastUsed('console-home') }); // Settings → Themes → Use this theme
    expect(result.current.theme.id).toBe('console-home');
  });
});
