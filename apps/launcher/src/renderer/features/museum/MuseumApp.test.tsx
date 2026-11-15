import { ok, type SystemInfo, type SystemInfoSummary } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
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
  },
  {
    systemId: 'genesis',
    name: 'Mega Drive',
    kind: 'console',
    manufacturer: 'Sega',
    releaseYear: 1988,
    edited: false,
  },
  {
    systemId: 'gameboy',
    name: 'Game Boy',
    kind: 'handheld',
    manufacturer: 'Nintendo',
    releaseYear: 1989,
    edited: false,
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
  });
  return { bridge, user: userEvent.setup() };
}

describe('MuseumApp', () => {
  it('FR-MUS-2: lists systems and filters by text and kind', async () => {
    const { user } = setup();
    renderInShell(<MuseumApp />);
    const list = await screen.findByRole('list', { name: 'Systems' });
    expect(await within(list).findByText('Mega Drive')).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
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
    expect(await screen.findByText('Super Nintendo')).toBeInTheDocument();
  });
});
