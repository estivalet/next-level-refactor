import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export type LoopbackResult = { code: string } | { cancelled: true } | { timeout: true };

export interface Loopback {
  /** `http://127.0.0.1:<port>/callback`, the redirect URI for this sign-in. */
  redirectUri: string;
  result: Promise<LoopbackResult>;
  /** Stops waiting (Cancel); `result` resolves as cancelled. */
  close(): void;
}

/**
 * The browser's way back to the launcher (RFC 8252, ADR-006): a one-shot listener on 127.0.0.1
 * and a random port. Only `/callback` with this sign-in's `state` counts — a code, or
 * `error=…` as a cancel; everything else is 404 and the wait goes on. The port closes after the
 * first answer, on timeout, or on close().
 */
export async function startLoopback(opts: {
  state: string;
  timeoutMs: number;
  /** The page the browser shows after the callback. */
  page: (outcome: 'ok' | 'cancelled') => string;
}): Promise<Loopback> {
  let settle: (result: LoopbackResult) => void = () => undefined;
  const result = new Promise<LoopbackResult>((resolve) => {
    settle = resolve;
  });
  let done = false;
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    if (done || request.method !== 'GET' || url.pathname !== '/callback' || state !== opts.state) {
      response.writeHead(404).end();
      return;
    }
    if (!code && !error) {
      response.writeHead(404).end();
      return;
    }
    const outcome = code ? 'ok' : 'cancelled';
    response
      .writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      .end(opts.page(outcome));
    finish(code ? { code } : { cancelled: true });
  });
  const timer = setTimeout(() => {
    finish({ timeout: true });
  }, opts.timeoutMs);
  function finish(outcome: LoopbackResult): void {
    if (done) return;
    done = true;
    clearTimeout(timer);
    server.close();
    // Browsers keep connections alive; drop them so the port really closes.
    server.closeAllConnections();
    settle(outcome);
  }
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
  const { port } = server.address() as AddressInfo;
  return {
    redirectUri: `http://127.0.0.1:${String(port)}/callback`,
    result,
    close: () => {
      finish({ cancelled: true });
    },
  };
}
