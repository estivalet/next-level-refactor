import { err, ok, type NextLevelBridge } from '@nextlevel/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';
import './i18n.ts';

function fakeBridge(result: Awaited<ReturnType<NextLevelBridge['invoke']>>): NextLevelBridge {
  // A fixed result can't satisfy the generic signature, so the fake is cast.
  return { invoke: (() => Promise.resolve(result)) as NextLevelBridge['invoke'] };
}

describe('App', () => {
  it('NFR-MAINT-1: shows Hello and the version from the bridge', async () => {
    render(<App bridge={fakeBridge(ok('0.0.0'))} />);
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(await screen.findByText('Version 0.0.0')).toBeInTheDocument();
  });

  it('shows "Version unavailable" when the bridge returns an error', async () => {
    render(<App bridge={fakeBridge(err('INTERNAL', 'errors.internal'))} />);
    expect(await screen.findByText('Version unavailable')).toBeInTheDocument();
  });
});
