import { ok, type IpcChannel, type SystemInfo, type SystemPersonal } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { EntryView } from './EntryView.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const summary = {
  systemId: 'snes',
  name: 'Super Nintendo',
  kind: 'console' as const,
  manufacturer: 'Nintendo',
  releaseYear: 1990,
  edited: false,
  hasNotes: false,
  changedAt: null,
};

const entry: SystemInfo = {
  systemId: 'snes',
  cpu: 'Ricoh 5A22',
  models: [],
  peripherals: [],
  topGames: [],
  sources: [],
};

const file = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}.png`;

function setup({ personalFails = false }: { personalFails?: boolean } = {}) {
  let personal: SystemPersonal = { systemId: 'snes', gallery: [{ file: file(1), caption: 'Box' }] };
  let current = entry;
  const bridge = installFakeBridge({
    'systems.info.get': () => ok({ entry: current, edited: false }),
    'systems.info.save': ({ entry: saved }) => {
      current = saved;
      return ok(saved);
    },
    'systems.personal.get': () =>
      personalFails
        ? { ok: false, error: { code: 'INTERNAL', message: 'errors.internal' } }
        : ok(personal),
    'systems.personal.save': ({ personal: saved }) => {
      personal = saved;
      return ok(saved);
    },
    'systems.personal.addImages': () => ok({ added: [{ file: file(2) }], rejected: [] }),
    'systems.personal.cleanup': () => ok(undefined),
  });
  renderInShell(<EntryView system={summary} />);
  const sent = (channel: IpcChannel) => bridge.calls.find((call) => call.channel === channel);
  return { bridge, sent, user: userEvent.setup() };
}

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Edit' }));
  return screen.findByRole('form', { name: 'Edit Super Nintendo' });
}

describe('EntryView gallery (FR-MUS-8)', () => {
  it('FR-MUS-8: the gallery shows between Models and Related on the page', async () => {
    setup();
    const article = await screen.findByRole('article', { name: 'Super Nintendo' });
    const gallery = await within(article).findByRole('region', { name: 'Gallery' });
    expect(within(gallery).getByRole('button', { name: 'Box' })).toBeInTheDocument();
    const names = within(article)
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-label'));
    expect(names.indexOf('Gallery')).toBe(names.indexOf('Models') + 1);
    expect(names.indexOf('Related')).toBe(names.indexOf('Gallery') + 1);
  });

  it('FR-MUS-8: images added in the editor are saved with the personal record', async () => {
    const { bridge, sent, user } = setup();
    const form = await openForm(user);
    const gallery = within(form).getByRole('region', { name: 'Gallery' });
    await user.click(within(gallery).getByRole('button', { name: 'Add images' }));
    await within(gallery).findByRole('img', { name: 'Image 2' });
    await user.type(within(gallery).getAllByLabelText('Caption')[1] as HTMLElement, ' Cart ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('form')).toBeNull();
    });
    expect((sent('systems.personal.save')?.input as { personal: SystemPersonal }).personal).toEqual(
      {
        systemId: 'snes',
        gallery: [
          { file: file(1), caption: 'Box' },
          { file: file(2), caption: 'Cart' },
        ],
      },
    );
    expect(bridge.channels()).not.toContain('systems.info.save');
    expect(bridge.channels()).not.toContain('systems.personal.cleanup');
  });

  it('FR-MUS-8: adding images in the editor and then discarding cleans them up', async () => {
    const { bridge, sent, user } = setup();
    const form = await openForm(user);
    const gallery = within(form).getByRole('region', { name: 'Gallery' });
    await user.click(within(gallery).getByRole('button', { name: 'Add images' }));
    await within(gallery).findByRole('img', { name: 'Image 2' });
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard changes' }),
    );

    await waitFor(() => {
      expect(bridge.channels()).toContain('systems.personal.cleanup');
    });
    expect(sent('systems.personal.cleanup')?.input).toEqual({ systemId: 'snes' });
    expect(bridge.channels()).not.toContain('systems.personal.save');
  });

  it('FR-MUS-6: when the notes and images fail to load the entry still shows and edits', async () => {
    const { sent, user } = setup({ personalFails: true });
    const article = await screen.findByRole('article', { name: 'Super Nintendo' });
    expect(await within(article).findByText('Ricoh 5A22')).toBeInTheDocument();
    for (const name of ['Notes', 'Gallery']) {
      const region = within(article).getByRole('region', { name });
      expect(within(region).getByText('Could not load your notes and images.')).toBeVisible();
    }
    expect(within(article).queryByText('Could not load this entry.')).toBeNull();

    const form = await openForm(user);
    const notes = within(form).getByRole('region', { name: 'Notes' });
    expect(within(notes).queryByRole('textbox')).toBeNull();
    expect(within(notes).getByText('Could not load your notes and images.')).toBeVisible();
    const gallery = within(form).getByRole('region', { name: 'Gallery' });
    expect(within(gallery).queryByRole('button', { name: 'Add images' })).toBeNull();

    const cpu = within(within(form).getByRole('region', { name: 'Hardware' })).getByLabelText(
      'CPU',
    );
    await user.type(cpu, 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.queryByRole('form')).toBeNull();
    });
    expect((sent('systems.info.save')?.input as { entry: SystemInfo }).entry.cpu).toBe(
      'Ricoh 5A22x',
    );
    expect(sent('systems.personal.save')).toBeUndefined();
  });
});
