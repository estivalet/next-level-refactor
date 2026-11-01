import { ok, type GameExportRequest } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { ExportDialog } from './ExportDialog.tsx';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  setBridgeForTests(null);
});

const scope = { kind: 'system', systemId: 'nintendo-64' } as const;

function setup() {
  const requests: GameExportRequest[] = [];
  installFakeBridge({
    'library.export': (input) => {
      requests.push(input);
      return ok({ status: 'saved' as const, count: 2 });
    },
  });
  const props = {
    scope,
    title: 'Nintendo 64',
    view: { tab: 'favorites' as const, genre: 'Racing' },
    counts: { every: 12, shown: 2 },
    onClose: vi.fn(),
  };
  const view = renderInShell(<ExportDialog {...props} />);
  return { requests, props, view };
}

describe('ExportDialog (FR-LIB-11)', () => {
  it('exports every game as CSV by default, without the description', async () => {
    const { requests } = setup();
    expect(screen.getByRole('checkbox', { name: 'Description' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Title' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Export…' }));

    expect(await screen.findByText('Exported 2 games.')).toBeInTheDocument();
    expect(requests[0]).toMatchObject({ scope, view: null, format: 'csv', title: 'Nintendo 64' });
    expect(requests[0]?.fields).not.toContain('description');
  });

  it('exports only the shown games with the fields ticked', async () => {
    const { requests } = setup();
    await userEvent.click(screen.getByRole('radio', { name: /Only the games shown \(2\)/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'JSON' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Description' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Genre' }));

    await userEvent.click(screen.getByRole('button', { name: 'Export…' }));

    await screen.findByText('Exported 2 games.');
    expect(requests[0]?.view).toEqual({ tab: 'favorites', genre: 'Racing' });
    expect(requests[0]?.format).toBe('json');
    expect(requests[0]?.fields).toContain('description');
    expect(requests[0]?.fields).not.toContain('genre');
  });

  it('gamelist.xml locks the path and turns off fields it has no tag for', async () => {
    setup();
    await userEvent.click(screen.getByRole('radio', { name: 'EmulationStation (gamelist.xml)' }));
    expect(screen.getByRole('checkbox', { name: 'File path' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'File path' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'My rating' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Year' })).toBeEnabled();
  });

  it('remembers the format and fields for next time', async () => {
    const { view } = setup();
    await userEvent.click(screen.getByRole('radio', { name: 'JSON' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Description' }));
    view.unmount();

    setup();
    expect(screen.getByRole('radio', { name: 'JSON' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Description' })).toBeChecked();
  });
});
