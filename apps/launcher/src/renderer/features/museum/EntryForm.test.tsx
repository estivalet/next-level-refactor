import { ok, remoteImageUrl, type SystemInfo, type SystemPersonal } from '@nextlevel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
  edited: true,
  hasNotes: false,
  changedAt: null,
};

const entry: SystemInfo = {
  systemId: 'snes',
  manufacturer: 'Nintendo',
  releaseYear: 1990,
  cpu: 'Ricoh 5A22',
  models: [{ name: 'SNS-101', imageUrl: 'https://example.com/snes.png' }],
  peripherals: [],
  topGames: [],
  sources: [],
};

const shipped: SystemInfo = { ...entry, cpu: 'Shipped CPU' };

function setup(
  edited = true,
  initial: SystemInfo = entry,
  personal: SystemPersonal = { systemId: 'snes', gallery: [] },
) {
  let current = initial;
  let isEdited = edited;
  let currentPersonal = personal;
  const bridge = installFakeBridge({
    'systems.personal.get': () => ok(currentPersonal),
    'systems.personal.save': ({ personal: saved }) => {
      currentPersonal = saved;
      return ok(saved);
    },
    'systems.personal.cleanup': () => ok(undefined),
    'systems.info.get': () => ok({ entry: current, edited: isEdited }),
    'systems.info.save': ({ entry: saved }) => {
      current = saved;
      isEdited = true;
      return ok(saved);
    },
    'systems.info.reset': () => {
      current = shipped;
      isEdited = false;
      return ok(shipped);
    },
  });
  renderInShell(<EntryView system={summary} />);
  return { bridge, user: userEvent.setup() };
}

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Edit' }));
  return screen.findByRole('form', { name: 'Edit Super Nintendo' });
}

describe('EntryForm', () => {
  it('FR-MUS-2: editing a field and saving sends the whole entry', async () => {
    const { bridge, user } = setup();
    const form = await openForm(user);
    const cpu = within(within(form).getByRole('region', { name: 'Hardware' })).getByLabelText(
      'CPU',
    );
    await user.clear(cpu);
    await user.type(cpu, 'Ricoh 5A22 rev 2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(bridge.channels()).toContain('systems.info.save');
    });
    const saved = bridge.calls.find((call) => call.channel === 'systems.info.save');
    expect(saved?.input).toEqual({
      systemId: 'snes',
      entry: { ...entry, cpu: 'Ricoh 5A22 rev 2' },
    });
    await waitFor(() => {
      expect(screen.queryByRole('form')).toBeNull();
    });
  });

  it('FR-MUS-2: an invalid year shows an error and does not save', async () => {
    const { bridge, user } = setup();
    const form = await openForm(user);
    const year = within(within(form).getByRole('region', { name: 'Overview' })).getByLabelText(
      'Released',
    );
    await user.clear(year);
    await user.type(year, '1800');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await within(form).findByText('Enter a year between 1900 and 2100.')).toBeVisible();
    expect(year).toHaveAttribute('aria-invalid', 'true');
    expect(bridge.channels()).not.toContain('systems.info.save');
  });

  it('FR-MUS-2: an emptied year is left out, not saved as 0', async () => {
    const { bridge, user } = setup();
    const form = await openForm(user);
    await user.clear(
      within(within(form).getByRole('region', { name: 'Overview' })).getByLabelText('Released'),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(bridge.channels()).toContain('systems.info.save');
    });
    const saved = bridge.calls.find((call) => call.channel === 'systems.info.save');
    expect(saved?.input).toMatchObject({ systemId: 'snes' });
    expect((saved?.input as { entry: SystemInfo }).entry.releaseYear).toBeUndefined();
  });

  it('FR-MUS-2: discarding a dirty form asks first', async () => {
    const { user } = setup();
    const form = await openForm(user);
    await user.type(
      within(within(form).getByRole('region', { name: 'Hardware' })).getByLabelText('CPU'),
      'x',
    );
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByRole('form')).toBeNull();
    expect(await screen.findByText('Ricoh 5A22')).toBeInTheDocument();
  });

  it('FR-MUS-2: reset asks to confirm, then restores the shipped entry', async () => {
    const { bridge, user } = setup();
    await openForm(user);
    await user.click(screen.getByRole('button', { name: 'Reset to original' }));
    const dialog = await screen.findByRole('dialog');
    expect(bridge.channels()).not.toContain('systems.info.reset');
    await user.click(within(dialog).getByRole('button', { name: 'Reset to original' }));

    await waitFor(() => {
      expect(bridge.channels()).toContain('systems.info.reset');
    });
    expect(bridge.calls.find((call) => call.channel === 'systems.info.reset')?.input).toEqual({
      systemId: 'snes',
    });
    expect(await screen.findByText('Shipped CPU')).toBeInTheDocument();
  });

  it('FR-MUS-2: reset is hidden for an entry that was never edited', async () => {
    const { user } = setup(false);
    await openForm(user);
    expect(screen.queryByRole('button', { name: 'Reset to original' })).toBeNull();
  });

  it('FR-MUS-4: model images load through nextlevel://remote-image; a broken one shows the placeholder in the same box', async () => {
    setup();
    const view = await screen.findByRole('article', { name: 'Super Nintendo' });
    const img = await within(view).findByRole('img', { name: 'SNS-101' });
    expect(img).toHaveAttribute('src', remoteImageUrl('https://example.com/snes.png'));
    const box = img.parentElement;
    fireEvent.error(img);
    expect(within(view).queryByRole('img', { name: 'SNS-101' })).toBeNull();
    const placeholder = within(view).getByTestId('model-image-placeholder');
    expect(placeholder.parentElement).toBe(box);
  });

  it('FR-MUS-2: typing an image link does not request an image per keystroke', async () => {
    const { user } = setup();
    const form = await openForm(user);
    const models = within(form).getByRole('region', { name: 'Models' });
    const field = within(models).getByLabelText('Image link');
    const sources = () =>
      within(models)
        .queryAllByRole('img', { name: 'SNS-101' })
        .map((img) => img.getAttribute('src'));
    const original = remoteImageUrl('https://example.com/snes.png');
    expect(sources()).toEqual([original]);

    await user.clear(field);
    await user.type(field, 'https://example.com/new.png');
    // While typing, the preview still shows the settled value: no request for the partial links.
    expect(sources()).toEqual([original]);
    await waitFor(
      () => {
        expect(sources()).toEqual([remoteImageUrl('https://example.com/new.png')]);
      },
      { timeout: 2000 },
    );
  });

  it('FR-MUS-2: a model without an image shows the placeholder', async () => {
    setup(true, { ...entry, models: [{ name: 'SNS-101' }] });
    const view = await screen.findByRole('article', { name: 'Super Nintendo' });
    expect(await within(view).findByTestId('model-image-placeholder')).toBeInTheDocument();
  });

  it('FR-MUS-5: only https sources are links', async () => {
    setup(true, {
      ...entry,
      sources: [
        { name: 'Secure', url: 'https://example.com/a' },
        { name: 'Plain', url: 'http://example.com/b' },
      ],
    });
    const view = await screen.findByRole('article', { name: 'Super Nintendo' });
    const sources = await within(view).findByRole('region', { name: 'Sources' });
    expect(within(sources).getByRole('link', { name: 'Secure' })).toBeInTheDocument();
    expect(within(sources).getByText('Plain').closest('a')).toBeNull();
  });

  it('FR-MUS-6: notes show first on the page', async () => {
    setup(true, entry, {
      systemId: 'snes',
      notes: 'Use the 1CHIP model.\nAvoid HDMI mods.',
      gallery: [],
    });
    const view = await screen.findByRole('article', { name: 'Super Nintendo' });
    const notes = await within(view).findByRole('region', { name: 'Notes' });
    const regions = within(view).getAllByRole('region');
    expect(regions[0]).toBe(notes);
    expect(regions[1]).toHaveAccessibleName('Emulators');
    const text = within(notes).getByText(/Use the 1CHIP model\./);
    expect(text.textContent).toBe('Use the 1CHIP model.\nAvoid HDMI mods.');
    expect(text).toHaveClass('whitespace-pre-line');
  });

  it('FR-MUS-6: saving only notes calls systems.personal.save and never systems.info.save', async () => {
    const { bridge, user } = setup();
    const form = await openForm(user);
    const regions = within(form).getAllByRole('region');
    expect(regions[0]).toHaveAccessibleName('Notes');
    const notes = within(regions[0] as HTMLElement).getByLabelText('Notes');
    expect(notes).toHaveAttribute('rows', '10');
    await user.type(notes, 'Runs best on bsnes.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('form')).toBeNull();
    });
    expect(bridge.channels()).not.toContain('systems.info.save');
    expect(bridge.calls.find((call) => call.channel === 'systems.personal.save')?.input).toEqual({
      systemId: 'snes',
      personal: { systemId: 'snes', notes: 'Runs best on bsnes.', gallery: [] },
    });
    expect(await screen.findByText('Runs best on bsnes.')).toBeInTheDocument();
  });

  it('FR-MUS-6: saving only the entry never calls systems.personal.save', async () => {
    const { bridge, user } = setup();
    const form = await openForm(user);
    await user.type(
      within(within(form).getByRole('region', { name: 'Hardware' })).getByLabelText('CPU'),
      'x',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.queryByRole('form')).toBeNull();
    });
    expect(bridge.channels()).toContain('systems.info.save');
    expect(bridge.channels()).not.toContain('systems.personal.save');
  });

  it('FR-MUS-6: clearing the notes saves a record without notes', async () => {
    const { bridge, user } = setup(true, entry, { systemId: 'snes', notes: 'Old', gallery: [] });
    const form = await openForm(user);
    const notes = within(within(form).getByRole('region', { name: 'Notes' })).getByLabelText(
      'Notes',
    );
    await user.clear(notes);
    await user.type(notes, '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('form')).toBeNull();
    });
    const saved = bridge.calls.find((call) => call.channel === 'systems.personal.save');
    const sent = (saved?.input as { personal: SystemPersonal }).personal;
    expect(sent.notes).toBeUndefined();
    expect(sent).toEqual({ systemId: 'snes', gallery: [] });
  });

  it('FR-MUS-6: discarding after adding images calls systems.personal.cleanup', async () => {
    const { bridge, user } = setup();
    const form = await openForm(user);
    await user.type(
      within(within(form).getByRole('region', { name: 'Notes' })).getByLabelText('Notes'),
      'draft',
    );
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Discard changes' }));

    await waitFor(() => {
      expect(bridge.channels()).toContain('systems.personal.cleanup');
    });
    expect(bridge.calls.find((call) => call.channel === 'systems.personal.cleanup')?.input).toEqual(
      { systemId: 'snes' },
    );
    expect(bridge.channels()).not.toContain('systems.personal.save');
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('FR-MUS-6: discarding an entry-only edit does not clean up images', async () => {
    const { bridge, user } = setup();
    const form = await openForm(user);
    await user.type(
      within(within(form).getByRole('region', { name: 'Hardware' })).getByLabelText('CPU'),
      'x',
    );
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard changes' }),
    );
    expect(screen.queryByRole('form')).toBeNull();
    expect(bridge.channels()).not.toContain('systems.personal.cleanup');
  });

  it('FR-MUS-6: the reset confirm says notes and images are kept', async () => {
    const { user } = setup();
    await openForm(user);
    await user.click(screen.getByRole('button', { name: 'Reset to original' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Your notes and images are kept\./)).toBeInTheDocument();
  });
});
