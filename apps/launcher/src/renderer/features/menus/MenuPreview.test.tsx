import { ok, type MenuDocNode, type MenuNode } from '@nextlevel/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { Desktop } from '../shell/Desktop.tsx';
import { useShell } from '../shell/ShellContext.tsx';
import { menusFake, refsResponses, sampleNodes, storedMenu } from './testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

const NO_ART = { packFiles: [], assetsFiles: [], manifest: null, warnings: [] };

/** A stand-in for main's resolver: categories and systems, labels as the editor set them. */
function resolved(nodes: readonly MenuDocNode[]): MenuNode[] {
  return nodes.map((node) => ({
    id: node.type === 'category' ? `m:${node.id}` : `s:${node.refId ?? ''}`,
    name: node.name,
    display: node.displayName ?? node.name,
    type: node.type === 'category' ? 'category' : 'system',
    ...(node.type === 'system' ? { systemId: node.refId ?? '' } : {}),
    children: resolved(node.children),
  }));
}

function OpenEditor() {
  const { dispatch } = useShell();
  useEffect(() => {
    dispatch({
      type: 'open',
      appId: 'menu-editor',
      size: { width: 900, height: 600 },
      singleInstance: true,
    });
  }, [dispatch]);
  return null;
}

function setup() {
  const fake = menusFake([storedMenu('Main', sampleNodes(), true)]);
  const bridge = installFakeBridge({
    ...fake.responses,
    ...refsResponses(),
    'frontend.resolveMenu': ({ draft }) => ok({ title: draft.title, items: resolved(draft.nodes) }),
    'frontend.games': () => ok([]),
    'frontend.artIndex': () => ok(NO_ART),
    'launch.running': () => ok(null),
  });
  renderInShell(
    <>
      <Desktop />
      <OpenEditor />
    </>,
  );
  return { bridge, user: userEvent.setup() };
}

function press(code: string) {
  const target = document.activeElement ?? document.body;
  fireEvent.keyDown(target, { code });
  fireEvent.keyUp(target, { code });
}

describe('Menu Editor preview', () => {
  it('US-D5: preview shows the unsaved rename; leaving returns to the still-dirty editor', async () => {
    const { bridge, user } = setup();
    await user.click(await screen.findByRole('treeitem', { name: 'Sega' }));
    await user.keyboard('{F2}');
    const input = await screen.findByRole('textbox', { name: 'New name' });
    await user.clear(input);
    await user.type(input, 'SEGA!{Enter}');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByTestId('menu-preview-layer')).toBeInTheDocument();
    await waitFor(() => {
      expect(bridge.channels()).toContain('frontend.resolveMenu');
    });
    const sent = bridge.calls.find((call) => call.channel === 'frontend.resolveMenu')?.input as {
      draft: { nodes: MenuDocNode[] };
    };
    expect(sent.draft.nodes.map((node) => node.name)).toEqual(['Nintendo', 'SEGA!', 'Sega Saturn']);
    act(() => {
      press('KeyM');
    });
    await waitFor(() => {
      expect(screen.queryByTestId('menu-preview-layer')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('img', { name: 'Unsaved changes' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'SEGA!' })).toBeInTheDocument();
    expect(bridge.channels()).not.toContain('frontend.themeOpened');
  });
});
