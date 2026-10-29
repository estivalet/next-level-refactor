import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

interface Answer {
  status?: number;
  body?: unknown;
}

/** Answers a request; a promise keeps it pending until it settles. */
type Handler = (request: {
  method: string;
  path: string;
  body: unknown;
}) => Answer | Promise<Answer>;

/** Stubs fetch with routes keyed `"<METHOD> <path without query>"`; records every call. */
export function stubApi(routes: Record<string, Handler>) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body });
    const path = url.split('?')[0] ?? url;
    const handler = routes[`${method} ${path}`];
    const answer: Answer | Promise<Answer> = handler
      ? handler({ method, path, body })
      : { status: 404, body: { error: { code: 'NOT_FOUND', message: 'm', requestId: 'r' } } };
    return Promise.resolve(answer).then(
      (settled) =>
        new Response(settled.body === undefined ? null : JSON.stringify(settled.body), {
          status: settled.status ?? 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
  });
  return calls;
}

export function renderPage(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return Object.assign(render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>), {
    client,
  });
}

export const user = (id: string, email: string, overrides: Record<string, unknown> = {}) => ({
  id,
  email,
  name: email.split('@')[0] ?? email,
  avatarUrl: null,
  role: 'subscriber',
  status: 'active',
  devices: 1,
  plan: { slug: 'default', name: 'Default' },
  lastSeenAt: '2026-10-25T10:00:00.000Z',
  createdAt: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

/** An upload the test settles: report progress, then answer. */
export interface PendingUpload {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  progress: (loaded: number, total: number) => void;
  respond: (status: number, body: unknown) => void;
}

/** Replaces XMLHttpRequest (the console's uploads); each send lands in the returned list. */
export function stubUploads() {
  const uploads: PendingUpload[] = [];
  class FakeXhr {
    upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    status = 0;
    responseText = '';
    withCredentials = false;
    #url = '';
    #headers: Record<string, string> = {};
    open(_method: string, url: string) {
      this.#url = url;
    }
    setRequestHeader(name: string, value: string) {
      this.#headers[name.toLowerCase()] = value;
    }
    send(body: unknown) {
      uploads.push({
        url: this.#url,
        headers: this.#headers,
        body,
        progress: (loaded, total) => {
          this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
        },
        respond: (status, answer) => {
          this.status = status;
          this.responseText = JSON.stringify(answer);
          this.onload?.();
        },
      });
    }
  }
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  return uploads;
}
