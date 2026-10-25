import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { defaultPicks, selectionOf } from './picks.ts';
import { PreviewTable } from './PreviewTable.tsx';
import { SAMPLE_PREVIEW } from './testing.ts';

afterEach(() => {
  setBridgeForTests(null);
});

describe('defaultPicks (FR-SCR-1, D19)', () => {
  it('US-C5: missing art and empty fields are ticked; title and locked fields never are', () => {
    const picks = defaultPicks(SAMPLE_PREVIEW, false);
    expect(selectionOf(picks)).toEqual({ kinds: ['video', 'logo-clear'], fields: ['year'] });
  });

  it('Overwrite existing ticks what is available, but still not title or locked fields', () => {
    const picks = defaultPicks(SAMPLE_PREVIEW, true);
    expect(selectionOf(picks)).toEqual({
      kinds: ['box-front', 'video', 'logo-clear'],
      fields: ['year', 'developer'],
    });
  });
});

describe('PreviewTable', () => {
  function setup(picks = defaultPicks(SAMPLE_PREVIEW, false)) {
    const toggled: Array<[string, boolean]> = [];
    installFakeBridge();
    renderInShell(
      <PreviewTable
        preview={SAMPLE_PREVIEW}
        picks={picks}
        onToggle={(key, value) => {
          toggled.push([key, value]);
        }}
      />,
    );
    return { toggled };
  }

  it('shows each kind and field with what is there now; unavailable rows are disabled', () => {
    setup();
    expect(screen.getByRole('checkbox', { name: 'Box front' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Clear logo' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Fanart' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Title' })).not.toBeChecked();
    const developer = screen.getByRole('checkbox', { name: 'Developer' }).closest('label');
    expect(within(developer as HTMLElement).getByText('Old Dev')).toBeInTheDocument();
    expect(within(developer as HTMLElement).getByText('Dev Co')).toBeInTheDocument();
  });

  it('D19: a locked field says so and can still be ticked on purpose', async () => {
    const user = userEvent.setup();
    const { toggled } = setup();
    const genre = screen.getByRole('checkbox', { name: 'Genre' });
    expect(genre).not.toBeChecked();
    expect(genre).toHaveAccessibleDescription(/edited by you/i);
    await user.click(genre);
    expect(toggled).toEqual([['field:genre', true]]);
  });
});
