import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function noSession() {
  vi.stubGlobal('fetch', () =>
    Promise.resolve(
      new Response(
        JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'm', requestId: 'r' } }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' },
        },
      ),
    ),
  );
}

describe('console sign-in (S13, ADR-006 web flow)', () => {
  it('without a session the sign-in page links to the API start route', async () => {
    noSession();
    render(<App />);
    const link = await screen.findByRole('link', { name: 'Sign in with Google' });
    expect(link).toHaveAttribute('href', '/v1/auth/google/start');
  });

  it('?error=notAdmin explains the refusal', async () => {
    noSession();
    window.history.replaceState(null, '', '/?error=notAdmin');
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent("This account isn't an admin.");
  });
});
