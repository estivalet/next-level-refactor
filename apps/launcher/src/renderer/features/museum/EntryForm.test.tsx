import { ok, remoteImageUrl, type SystemInfo } from '@nextlevel/shared';
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

function setup(edited = true, initial: SystemInfo = entry) {
  let current = initial;
  let isEdited = edited;
  const bridge = installFakeBridge({
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
    await user.click(within(form).getByRole('button', { name: 'Save' }));

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
    await user.click(within(form).getByRole('button', { name: 'Save' }));

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
    await user.click(within(form).getByRole('button', { name: 'Save' }));
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
    await user.click(within(form).getByRole('button', { name: 'Discard' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByRole('form')).toBeNull();
    expect(await screen.findByText('Ricoh 5A22')).toBeInTheDocument();
  });

  it('FR-MUS-2: reset asks to confirm, then restores the shipped entry', async () => {
    const { bridge, user } = setup();
    const form = await openForm(user);
    await user.click(within(form).getByRole('button', { name: 'Reset to original' }));
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
    const form = await openForm(user);
    expect(within(form).queryByRole('button', { name: 'Reset to original' })).toBeNull();
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
});
