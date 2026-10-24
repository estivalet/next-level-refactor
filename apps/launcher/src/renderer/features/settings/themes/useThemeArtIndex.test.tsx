import { defaultSettings, ok, type ArtIndex, type Settings } from '@nextlevel/shared';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { useThemeArtIndex } from './useThemeArtIndex.ts';

afterEach(() => {
  setBridgeForTests(null);
});

const INDEX: ArtIndex = { packFiles: [], assetsFiles: [], manifest: null, warnings: [] };

function settingsWith(assetsPath: string): Settings {
  const settings = defaultSettings();
  return { ...settings, storage: { ...settings.storage, assetsPath } };
}

function Probe() {
  const index = useThemeArtIndex('big-box');
  return <p>{index.data ? 'loaded' : 'loading'}</p>;
}

describe('useThemeArtIndex', () => {
  it('FR-THM-2: a new art folder (e.g. after an import) refetches the art index', async () => {
    const bridge = installFakeBridge({
      'settings.get': () =>
        ok({ kind: 'ok', snapshot: { settings: settingsWith('C:\\Art\\A'), revision: 0 } }),
      'frontend.artIndex': () => ok(INDEX),
    });
    renderInShell(<Probe />);
    expect(await screen.findByText('loaded')).toBeVisible();
    const calls = () => bridge.channels().filter((c) => c === 'frontend.artIndex').length;
    expect(calls()).toBe(1);
    bridge.emit('settings.changed', { settings: settingsWith('C:\\Art\\B'), revision: 1 });
    await waitFor(() => {
      expect(calls()).toBe(2);
    });
  });
});
