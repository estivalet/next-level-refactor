import { ok, type SystemInfo, type SystemInfoSummary } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { getApp } from '../../apps/registry.ts';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { MuseumApp } from './MuseumApp.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const summaries: SystemInfoSummary[] = [
  {
    systemId: 'snes',
    name: 'Super Nintendo',
    kind: 'console',
    manufacturer: 'Nintendo',
    releaseYear: 1990,
    edited: true,
    hasNotes: false,
    changedAt: null,
  },
  {
    systemId: 'genesis',
    name: 'Mega Drive',
    kind: 'console',
    manufacturer: 'Sega',
    releaseYear: 1988,
    edited: false,
    hasNotes: false,
    changedAt: null,
  },
  {
    systemId: 'gameboy',
    name: 'Game Boy',
    kind: 'handheld',
    manufacturer: 'Nintendo',
    releaseYear: 1989,
    edited: false,
    hasNotes: false,
    changedAt: null,
  },
  {
    systemId: 'scummvm',
    name: 'ScummVM',
    kind: 'virtual',
    manufacturer: null,
    releaseYear: null,
    edited: false,
    hasNotes: false,
    changedAt: null,
  },
];

const snesEntry: SystemInfo = {
  systemId: 'snes',
  manufacturer: 'Nintendo',
  releaseYear: 1990,
  history: 'Launched in Japan as the Super Famicom.',
  cpu: 'Ricoh 5A22',
  models: [{ name: 'SNS-101', releaseYear: 1997 }],
  predecessor: 'NES',
  peripherals: ['Super Scope'],
  topGames: [{ title: 'Super Metroid', year: 1994 }],
  sources: [
    { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Super_Nintendo_Entertainment_System' },
    { name: 'Owner notes' },
  ],
};

function setup() {
  const bridge = installFakeBridge({
    'systems.info.list': () => ok(summaries),
    'systems.info.get': ({ systemId }) =>
      ok({
        entry:
          systemId === 'snes'
            ? snesEntry
            : { systemId, models: [], peripherals: [], topGames: [], sources: [] },
        edited: systemId === 'snes',
      }),
    'systems.personal.save': ({ personal }) => ok(personal),
    'systems.personal.cleanup': () => ok(undefined),
  });
  return { bridge, user: userEvent.setup() };
}

describe('MuseumApp', () => {
  it('FR-MUS-2: lists systems and filters by text and kind', async () => {
    const { user } = setup();
    renderInShell(<MuseumApp />);
    const list = await screen.findByRole('list', { name: 'Systems' });
    expect(await within(list).findByText('Mega Drive')).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(within(list).getByText('Nintendo · 1990')).toBeInTheDocument();
    expect(within(list).getAllByRole('img', { name: 'Edited' })).toHaveLength(1);

    await user.type(screen.getByRole('searchbox', { name: 'Search systems' }), 'sega');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Mega Drive')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search systems' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'handheld');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Game Boy')).toBeInTheDocument();
  });

  it('FR-MUS-10: virtual systems carry a Virtual badge and the Type filter finds them', async () => {
    const { user } = setup();
    renderInShell(<MuseumApp />);
    const list = await screen.findByRole('list', { name: 'Systems' });
    const scumm = await within(list).findByRole('button', { name: /ScummVM/ });
    expect(within(scumm).getByText('Virtual')).toBeInTheDocument();
    expect(scumm).toHaveAccessibleName(/Virtual/);
    expect(within(list).getAllByText('Virtual')).toHaveLength(1);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'virtual');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    await user.click(within(list).getByRole('button', { name: /ScummVM/ }));
    const selected = within(list).getByRole('button', { name: /ScummVM/ });
    expect(selected).toHaveAttribute('aria-current', 'page');
    expect(within(selected).getByText('Virtual')).toBeInTheDocument();
  });

  it('FR-MUS-2: selecting a system shows its sections and sources line (FR-MUS-5)', async () => {
    const { bridge, user } = setup();
    renderInShell(<MuseumApp />);
    await user.click(await screen.findByRole('button', { name: /Super Nintendo/ }));

    const entry = await screen.findByRole('article', { name: 'Super Nintendo' });
    await within(entry).findByText('Ricoh 5A22');
    for (const section of [
      'Overview',
      'Story',
      'Hardware',
      'Models',
      'Related',
      'Top games',
      'Sources',
    ]) {
      expect(within(entry).getByRole('region', { name: section })).toBeInTheDocument();
    }
    expect(within(entry).getByText('Launched in Japan as the Super Famicom.')).toBeInTheDocument();
    expect(within(entry).getByText('SNS-101')).toBeInTheDocument();
    expect(within(entry).getByText('Super Metroid')).toBeInTheDocument();
    expect(within(entry).getByText('Super Scope')).toBeInTheDocument();

    const sources = within(entry).getByRole('region', { name: 'Sources' });
    expect(within(sources).getByRole('link', { name: 'Wikipedia' })).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/wiki/Super_Nintendo_Entertainment_System',
    );
    expect(within(sources).getByText('Owner notes').closest('a')).toBeNull();
    expect(bridge.calls.find((call) => call.channel === 'systems.info.get')?.input).toEqual({
      systemId: 'snes',
    });
  });

  it('FR-MUS-2: empty sections say nothing is recorded', async () => {
    const { user } = setup();
    renderInShell(<MuseumApp />);
    await user.click(await screen.findByRole('button', { name: /Game Boy/ }));
    const entry = await screen.findByRole('article', { name: 'Game Boy' });
    const models = await within(entry).findByRole('region', { name: 'Models' });
    expect(within(models).getByText('Nothing recorded yet.')).toBeInTheDocument();
  });

  it('FR-MUS-2: the app opens from the registry', async () => {
    setup();
    const app = getApp('museum');
    expect(app).toMatchObject({
      titleKey: 'apps.museum.title',
      singleInstance: true,
      defaultSize: { width: 1200, height: 760 },
    });
    if (!app) throw new Error('museum app is not registered');
    const { Component } = app;
    renderInShell(<Component />);
    const list = await screen.findByRole('list', { name: 'Systems' });
    expect(await within(list).findByText('Super Nintendo')).toBeInTheDocument();
  });

  it('FR-MUS-2: a failed list load shows an error, not the empty list', async () => {
    installFakeBridge({
      'systems.info.list': () => ({
        ok: false,
        error: { code: 'INTERNAL', message: 'errors.internal' },
      }),
    });
    renderInShell(<MuseumApp />);
    expect(await screen.findByText('Could not load the systems.')).toBeInTheDocument();
    expect(screen.queryByText('No systems match.')).toBeNull();
  });

  it('FR-MUS-2: a failed background refresh keeps the app and shows the error inline', async () => {
    let fail = false;
    const { emit } = installFakeBridge({
      'systems.info.list': () =>
        fail
          ? { ok: false, error: { code: 'INTERNAL', message: 'errors.internal' } }
          : ok(summaries),
    });
    renderInShell(<MuseumApp />);
    const list = await screen.findByRole('list', { name: 'Systems' });
    expect(await within(list).findByText('Mega Drive')).toBeInTheDocument();
    fail = true;
    emit('systems.infoChanged', { systemId: 'snes' });
    expect(await screen.findByText('Could not load the systems.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Systems' })).toBeInTheDocument();
    expect(within(list).getByText('Mega Drive')).toBeInTheDocument();
  });
});

describe('MuseumApp unsaved edits (FR-MUS-2)', () => {
  async function dirtySnes(user: ReturnType<typeof userEvent.setup>) {
    renderInShell(<MuseumApp />);
    await user.click(await screen.findByRole('button', { name: /Super Nintendo/ }));
    const entry = await screen.findByRole('article', { name: 'Super Nintendo' });
    await user.click(await within(entry).findByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('form');
    const cpu = within(within(form).getByRole('region', { name: 'Hardware' })).getByLabelText(
      'CPU',
    );
    await user.type(cpu, 'x');
    return cpu;
  }

  it('FR-MUS-2: switching system with a dirty draft asks first; cancel keeps the draft', async () => {
    const { user } = setup();
    const cpu = await dirtySnes(user);
    await user.click(screen.getByRole('button', { name: /Mega Drive/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Discard your changes?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('article', { name: 'Super Nintendo' })).toBeInTheDocument();
    expect(cpu).toHaveValue('Ricoh 5A22x');
  });

  it('FR-MUS-2: confirming the discard switches to the other system', async () => {
    const { user } = setup();
    await dirtySnes(user);
    await user.click(screen.getByRole('button', { name: /Mega Drive/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Discard changes' }));
    expect(await screen.findByRole('article', { name: 'Mega Drive' })).toBeInTheDocument();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('FR-MUS-2: a clean form switches without asking', async () => {
    const { user } = setup();
    renderInShell(<MuseumApp />);
    await user.click(await screen.findByRole('button', { name: /Super Nintendo/ }));
    const entry = await screen.findByRole('article', { name: 'Super Nintendo' });
    await user.click(await within(entry).findByRole('button', { name: 'Edit' }));
    await screen.findByRole('form');
    await user.click(screen.getByRole('button', { name: /Mega Drive/ }));
    expect(await screen.findByRole('article', { name: 'Mega Drive' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('MuseumApp unsaved notes (FR-MUS-6)', () => {
  it('FR-MUS-6: switching system with unsaved notes asks first', async () => {
    const { bridge, user } = setup();
    renderInShell(<MuseumApp />);
    await user.click(await screen.findByRole('button', { name: /Super Nintendo/ }));
    const entry = await screen.findByRole('article', { name: 'Super Nintendo' });
    await user.click(await within(entry).findByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('form');
    await user.type(
      within(within(form).getByRole('region', { name: 'Notes' })).getByLabelText('Notes'),
      'draft',
    );
    await user.click(screen.getByRole('button', { name: /Mega Drive/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(bridge.channels()).not.toContain('systems.personal.cleanup');

    await user.click(screen.getByRole('button', { name: /Mega Drive/ }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard changes' }),
    );
    expect(await screen.findByRole('article', { name: 'Mega Drive' })).toBeInTheDocument();
    await waitFor(() => {
      expect(bridge.channels()).toContain('systems.personal.cleanup');
    });
    expect(bridge.calls.find((call) => call.channel === 'systems.personal.cleanup')?.input).toEqual(
      { systemId: 'snes' },
    );
    expect(bridge.channels()).not.toContain('systems.personal.save');
  });

  it('FR-MUS-6: leaving after an entry-only edit does not clean up images', async () => {
    const { bridge, user } = setup();
    await dirtySnesForCleanup(user);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard changes' }),
    );
    expect(screen.queryByRole('article')).toBeNull();
    expect(bridge.channels()).not.toContain('systems.personal.cleanup');
  });

  it('FR-MUS-6: saving notes and then going Home does not clean up images', async () => {
    const { bridge, user } = setup();
    renderInShell(<MuseumApp />);
    await user.click(await screen.findByRole('button', { name: /Super Nintendo/ }));
    const entry = await screen.findByRole('article', { name: 'Super Nintendo' });
    await user.click(await within(entry).findByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('form');
    await user.type(
      within(within(form).getByRole('region', { name: 'Notes' })).getByLabelText('Notes'),
      'saved',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.queryByRole('form')).toBeNull();
    });
    expect(bridge.channels()).toContain('systems.personal.save');

    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    expect(bridge.channels()).not.toContain('systems.personal.cleanup');
  });

  async function dirtySnesForCleanup(user: ReturnType<typeof userEvent.setup>) {
    renderInShell(<MuseumApp />);
    await user.click(await screen.findByRole('button', { name: /Super Nintendo/ }));
    const entry = await screen.findByRole('article', { name: 'Super Nintendo' });
    await user.click(await within(entry).findByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('form');
    await user.type(
      within(within(form).getByRole('region', { name: 'Hardware' })).getByLabelText('CPU'),
      'x',
    );
  }
});

describe('MuseumApp layout (FR-MUS-9)', () => {
  it('FR-MUS-9: the Museum opens on Home with the Home item current', async () => {
    setup();
    renderInShell(<MuseumApp />);
    const home = await screen.findByRole('button', { name: 'Home' });
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('article')).toBeNull();
    const snes = await screen.findByRole('button', { name: /Super Nintendo/ });
    expect(snes).not.toHaveAttribute('aria-current');
  });

  it('FR-MUS-9: picking a system shows its hero with name and "manufacturer · year"', async () => {
    const { user } = setup();
    renderInShell(<MuseumApp />);
    await user.click(await screen.findByRole('button', { name: /Super Nintendo/ }));
    const hero = await screen.findByTestId('system-hero');
    expect(within(hero).getByRole('heading', { name: 'Super Nintendo' })).toBeInTheDocument();
    expect(within(hero).getByText('Nintendo · 1990')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Super Nintendo/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('FR-MUS-9: in edit mode Save/Discard are outside the scrolling region', async () => {
    const { user } = setup();
    renderInShell(<MuseumApp />);
    await user.click(await screen.findByRole('button', { name: /Super Nintendo/ }));
    const entry = await screen.findByRole('article', { name: 'Super Nintendo' });
    await user.click(await within(entry).findByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('form');
    const scroll = screen.getByTestId('museum-scroll');
    expect(scroll).toContainElement(form);
    expect(scroll).not.toContainElement(screen.getByRole('button', { name: 'Save' }));
    expect(scroll).not.toContainElement(screen.getByRole('button', { name: 'Discard' }));
    expect(entry).toContainElement(screen.getByRole('button', { name: 'Save' }));
  });

  it('FR-MUS-9: going Home with unsaved edits asks before discarding', async () => {
    const { user } = setup();
    renderInShell(<MuseumApp />);
    await user.click(await screen.findByRole('button', { name: /Super Nintendo/ }));
    const entry = await screen.findByRole('article', { name: 'Super Nintendo' });
    await user.click(await within(entry).findByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('form');
    await user.type(
      within(within(form).getByRole('region', { name: 'Hardware' })).getByLabelText('CPU'),
      'x',
    );
    await user.click(screen.getByRole('button', { name: 'Home' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('form')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard changes' }),
    );
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });
});
