import { walkMenuNodes, type IpcInput, type MenuDocNode } from '@nextlevel/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { WindowCloseContext } from '../shell/closeGuard.ts';
import { MenuEditorApp } from './MenuEditorApp.tsx';
import { docNode, menusFake, sampleNodes, storedMenu } from './testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

function setup(stored = [storedMenu('Main', sampleNodes(), true)]) {
  const fake = menusFake(stored);
  const bridge = installFakeBridge(fake.responses);
  renderInShell(<MenuEditorApp />);
  const lastInput = <C extends 'menus.save' | 'menus.create'>(channel: C) =>
    bridge.calls.filter((call) => call.channel === channel).at(-1)?.input as
      IpcInput<C> | undefined;
  return { ...fake, bridge, lastInput, user: userEvent.setup() };
}

const row = (name: string) => screen.findByRole('treeitem', { name });
const names = (nodes: readonly MenuDocNode[]) => nodes.map((node) => node.name);

describe('MenuEditorApp', () => {
  it('FR-MENU-1: dragging a system onto a category and saving sends the moved tree', async () => {
    const { user, lastInput } = setup();
    const saturn = await row('Sega Saturn');
    const sega = await row('Sega');
    fireEvent.dragStart(saturn, { dataTransfer: { setData: () => undefined } });
    fireEvent.dragOver(sega);
    fireEvent.drop(sega);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(lastInput('menus.save')).toBeDefined();
    });
    const input = lastInput('menus.save');
    expect(input?.baseRevision).toBe(3);
    expect(names(input?.nodes ?? [])).toEqual(['Nintendo', 'Sega']);
    expect(names(input?.nodes[1]?.children ?? [])).toEqual(['Sega Genesis', 'Sega Saturn']);
  });

  it('FR-MENU-1: Alt+Up moves the selected node up', async () => {
    const { user, lastInput } = setup();
    await user.click(await row('Sega Saturn'));
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(names(lastInput('menus.save')?.nodes ?? [])).toEqual([
        'Nintendo',
        'Sega Saturn',
        'Sega',
      ]);
    });
  });

  it('FR-MENU-1: switching menus with unsaved changes asks first', async () => {
    const { user } = setup([
      storedMenu('Main', sampleNodes(), true),
      storedMenu('Kids', [docNode('Arcade')]),
    ]);
    await user.click(await row('Sega Saturn'));
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Menu' }), 'Kids');
    const ask = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(await row('Sega Saturn')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Menu' }), 'Kids');
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })).getByRole(
        'button',
        { name: 'Discard' },
      ),
    );
    expect(await row('Arcade')).toBeInTheDocument();
  });

  it('FR-MENU-1: a save over a newer version shows the conflict and Reload fetches it', async () => {
    const { user, menus, bump } = setup();
    await user.click(await row('Sega Saturn'));
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    const [main] = [...menus.values()];
    bump(main?.id ?? '');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('This menu was changed elsewhere.');
    await user.click(within(banner).getByRole('button', { name: 'Reload' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    const rows = screen.getAllByRole('treeitem').map((item) => item.getAttribute('aria-label'));
    expect(rows).toEqual(['Nintendo', 'Sega', 'Sega Saturn']);
  });

  it('FR-MENU-3: with no menus it edits the generated "Default" and Save creates it', async () => {
    const { user, lastInput } = setup([]);
    expect(await screen.findByRole('option', { name: 'Default (not saved)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(lastInput('menus.create')?.title).toBe('Default');
    });
    expect(names(lastInput('menus.create')?.nodes ?? [])).toEqual([
      'Nintendo',
      'Sega',
      'Sega Saturn',
    ]);
    expect(await screen.findByRole('option', { name: 'Default (active)' })).toBeInTheDocument();
  });

  it('FR-MENU-3: New → Generated asks main for a generated menu', async () => {
    const { user, bridge, lastInput } = setup();
    await row('Sega');
    await user.click(screen.getByRole('button', { name: 'New menu' }));
    const dialog = await screen.findByRole('dialog', { name: 'New menu' });
    await user.clear(within(dialog).getByRole('textbox', { name: 'Name' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Fresh');
    await user.click(within(dialog).getByRole('radio', { name: 'Generated from enabled systems' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(lastInput('menus.create')?.title).toBe('Fresh');
    });
    expect(bridge.channels()).toContain('menus.generated');
    expect(await screen.findByRole('option', { name: 'Fresh' })).toBeInTheDocument();
  });

  it('FR-MENU-1: New → Empty creates and selects an empty menu', async () => {
    const { user, lastInput } = setup();
    await row('Sega');
    await user.click(screen.getByRole('button', { name: 'New menu' }));
    const dialog = await screen.findByRole('dialog', { name: 'New menu' });
    await user.click(within(dialog).getByRole('radio', { name: 'Empty' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(lastInput('menus.create')?.nodes).toEqual([]);
    });
    expect(await screen.findByText('This menu is empty.')).toBeInTheDocument();
    const picker = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Menu' });
    expect(picker.selectedOptions[0]?.textContent).toBe('New menu');
  });

  it('FR-MENU-1: Duplicate copies the tree with new node ids', async () => {
    const { user, lastInput, menus } = setup();
    await row('Sega');
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    const dialog = await screen.findByRole('dialog', { name: 'New menu' });
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Copy of Main');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(lastInput('menus.create')).toBeDefined();
    });
    const copy = lastInput('menus.create')?.nodes ?? [];
    const [main] = [...menus.values()];
    const originalIds = new Set([...walkMenuNodes(main?.nodes ?? [])].map((node) => node.id));
    expect(names(copy)).toEqual(['Nintendo', 'Sega', 'Sega Saturn']);
    expect([...walkMenuNodes(copy)].some((node) => originalIds.has(node.id))).toBe(false);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('FR-MENU-1: closing the window with unsaved changes asks first', async () => {
    const fake = menusFake([storedMenu('Main', sampleNodes(), true)]);
    installFakeBridge(fake.responses);
    let guard: (() => boolean) | null = null;
    const close = vi.fn();
    const setGuard = (next: (() => boolean) | null) => {
      guard = next;
    };
    renderInShell(
      <WindowCloseContext value={{ setGuard, close }}>
        <MenuEditorApp />
      </WindowCloseContext>,
    );
    const user = userEvent.setup();
    await user.click(await row('Sega Saturn'));
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    let allowed: boolean | undefined;
    act(() => {
      allowed = guard?.();
    });
    expect(allowed).toBe(false);
    const ask = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    await user.click(within(ask).getByRole('button', { name: 'Discard' }));
    expect(close).toHaveBeenCalled();
  });
});
