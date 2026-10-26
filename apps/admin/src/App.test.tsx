import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { stubApi } from './test-utils.tsx';
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

  it('Sign out returns to the sign-in page', async () => {
    const u = userEvent.setup();
    let signedIn = true;
    stubApi({
      'GET /v1/auth/session': () =>
        signedIn
          ? {
              body: {
                user: {
                  id: 'u1',
                  email: 'admin@x.test',
                  name: 'A',
                  avatarUrl: null,
                  role: 'admin',
                },
                csrf: 'c',
              },
            }
          : {
              status: 401,
              body: { error: { code: 'UNAUTHENTICATED', message: 'm', requestId: 'r' } },
            },
      'POST /v1/auth/session/logout': () => {
        signedIn = false;
        return { status: 204 };
      },
      'GET /v1/admin/users': () => ({ body: { items: [], nextCursor: null } }),
    });
    render(<App />);
    await u.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('link', { name: 'Sign in with Google' })).toBeVisible();
  });
});
