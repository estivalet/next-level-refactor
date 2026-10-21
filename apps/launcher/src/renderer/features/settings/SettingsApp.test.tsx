import type { NextLevelBridge } from '@nextlevel/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import '../../i18n.ts';
import { SettingsApp } from './SettingsApp.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

function renderWithBridge(invoke: () => Promise<unknown>) {
  setBridgeForTests({ invoke: invoke as NextLevelBridge['invoke'] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsApp />
    </QueryClientProvider>,
  );
}

describe('SettingsApp', () => {
  it('IA §1 Settings > About: shows the About section with the version from the bridge', async () => {
    renderWithBridge(() => Promise.resolve({ ok: true, value: '0.0.0' }));
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About', pressed: true })).toBeInTheDocument();
    expect(await screen.findByText('Version 0.0.0')).toBeInTheDocument();
  });

  it('shows "Version unavailable" when invoke resolves an error', async () => {
    renderWithBridge(() =>
      Promise.resolve({ ok: false, error: { code: 'INTERNAL', message: 'errors.internal' } }),
    );
    expect(await screen.findByText('Version unavailable')).toBeInTheDocument();
  });

  it('shows "Version unavailable" when invoke rejects', async () => {
    renderWithBridge(() => Promise.reject(new Error('ipc down')));
    expect(await screen.findByText('Version unavailable')).toBeInTheDocument();
  });
});
