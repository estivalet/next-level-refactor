import { ApiErrorEnvelopeSchema, AppErrorException, ERROR_CODES } from '@nextlevel/shared';
import type { ZodType } from 'zod';

const listeners = new Set<() => void>();

/**
 * Called when the session may be gone: a 401 (idle, signed out elsewhere) or a 403 FORBIDDEN /
 * SUSPENDED (demoted or suspended since signing in, Review Focus 5). The app re-checks it.
 */
export function onUnauthenticated(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function csrfToken(): string | null {
  const match = /(?:^|;\s*)nl_csrf=([^;]*)/.exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * The error for a refused call: the envelope's code and details (INTERNAL without one). A lost
 * session (401, FORBIDDEN, SUSPENDED) tells the listeners when `notify` is set.
 */
export function failure(status: number, json: unknown, notify: boolean): AppErrorException {
  const envelope = ApiErrorEnvelopeSchema.safeParse(json);
  const code = envelope.success ? envelope.data.error.code : null;
  const lost = status === 401 || code === 'FORBIDDEN' || code === 'SUSPENDED';
  if (lost && notify) {
    for (const listener of listeners) listener();
  }
  return new AppErrorException(
    envelope.success
      ? {
          code: envelope.data.error.code,
          message: ERROR_CODES[envelope.data.error.code],
          details: envelope.data.error.details,
        }
      : { code: 'INTERNAL', message: ERROR_CODES.INTERNAL },
  );
}

/**
 * The console's call to its own API (same origin, cookie session): JSON in and out, the CSRF
 * cookie echoed in `X-CSRF-Token` on writes, error envelopes as AppErrorException.
 */
export async function apiFetch<T>(
  path: string,
  opts: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    schema: ZodType<T>;
    /** False for the session check itself, so its own 401 can't start another check. */
    notify?: boolean;
  },
): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const csrf = method === 'GET' ? null : csrfToken();
  if (csrf) headers['x-csrf-token'] = csrf;
  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
  });
  const text = await response.text();
  const json: unknown = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw failure(response.status, json, opts.notify !== false);
  return opts.schema.parse(json);
}
