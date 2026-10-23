import { walkMenuNodes, type IpcInput } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { MenuEditorApp } from './MenuEditorApp.tsx';
import { docNode, menusFake, refsResponses, storedMenu } from './testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

function setup() {
  const snes = docNode('Super Nintendo', 'system', [], { refId: 'snes' });
  const nodes = [
    docNode('Nintendo', 'category', [snes]),
    docNode('Sega', 'category', [docNode('Sega Genesis', 'system', [], { refId: 'genesis' })]),
    docNode('Picks', 'collection', [], { refId: '5' }),
  ];
  const fake = menusFake([storedMenu('Main', nodes, true)]);
  const bridge = installFakeBridge({ ...fake.responses, ...refsResponses() });
  renderInShell(<MenuEditorApp />);
  const saved = async () => {
    await waitFor(() => {
      expect(bridge.channels()).toContain('menus.save');
    });
    return bridge.calls.findLast((call) => call.channel === 'menus.save')
      ?.input as IpcInput<'menus.save'>;
  };
  return { snes, saved, user: userEvent.setup() };
}

const row = (name: string) => screen.findByRole('treeitem', { name });

describe('Menu Editor references', () => {
  it('FR-MENU-2: a node pointing at a deleted collection is greyed with the reason', async () => {
    setup();
    const picks = await row('Picks');
    expect(await within(picks).findByText('Collection deleted')).toBeInTheDocument();
  });

  it('FR-MENU-2: changing the target of a system node keeps its id', async () => {
    const { snes, saved, user } = setup();
    await user.click(await row('Nintendo'));
    await user.keyboard('{ArrowRight}');
    await user.click(await row('Super Nintendo'));
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Target' }),
      'Nintendo 64',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const node = [...walkMenuNodes((await saved()).nodes)].find((n) => n.id === snes.id);
    expect(node).toMatchObject({ refId: 'nintendo-64', name: 'Nintendo 64' });
  });

  it('FR-MENU-4: editing the display name updates the row label', async () => {
    const { user } = setup();
    await user.click(await row('Sega'));
    const display = await screen.findByRole('textbox', { name: 'Display name' });
    await user.type(display, 'SEGA{Enter}');
    expect(await row('SEGA')).toBeInTheDocument();
  });

  it('D8: an enabled system not in the menu is listed and Add puts it under "Nintendo"', async () => {
    const { saved, user } = setup();
    const list = await screen.findByRole('region', { name: 'Not in this menu' });
    await user.click(await within(list).findByRole('button', { name: 'Add Nintendo 64' }));
    const added = await row('Nintendo 64');
    expect(added).toHaveAttribute('aria-level', '2');
    expect(within(list).queryByRole('button', { name: 'Add Nintendo 64' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await saved()).nodes[0]?.children.map((n) => n.refId)).toEqual(['snes', 'nintendo-64']);
  });

  it('FR-MENU-2: after a retarget renames the node, leaving the Name field keeps the new name', async () => {
    const { snes, saved, user } = setup();
    await user.click(await row('Nintendo'));
    await user.keyboard('{ArrowRight}');
    await user.click(await row('Super Nintendo'));
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Target' }),
      'Nintendo 64',
    );
    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name).toHaveValue('Nintendo 64');
    await user.click(name);
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const node = [...walkMenuNodes((await saved()).nodes)].find((n) => n.id === snes.id);
    expect(node?.name).toBe('Nintendo 64');
  });

  it('FR-MENU-4: Ctrl+S while typing in a field saves what was typed', async () => {
    const { saved, user } = setup();
    await user.click(await row('Sega'));
    await user.type(await screen.findByRole('textbox', { name: 'Display name' }), 'SEGA');
    await user.keyboard('{Control>}s{/Control}');
    expect((await saved()).nodes[1]?.displayName).toBe('SEGA');
  });
});
