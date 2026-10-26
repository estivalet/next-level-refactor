import { ApiErrorEnvelopeSchema, AppErrorException, ERROR_CODES } from '@nextlevel/shared';
import type { ZodType } from 'zod';

const listeners = new Set<() => void>();

/** Called on every 401: the session ended (idle, signed out elsewhere, demoted). */
export function onUnauthenticated(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function csrfToken(): string | null {
  const match = /(?:^|;\s*)nl_csrf=([^;]*)/.exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * The console's call to its own API (same origin, cookie session): JSON in and out, the CSRF
 * cookie echoed in `X-CSRF-Token` on writes, error envelopes as AppErrorException.
 */
export async function apiFetch<T>(
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; schema: ZodType<T> },
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
  if (!response.ok) {
    if (response.status === 401) for (const listener of listeners) listener();
    const envelope = ApiErrorEnvelopeSchema.safeParse(json);
    throw new AppErrorException(
      envelope.success
        ? {
            code: envelope.data.error.code,
            message: ERROR_CODES[envelope.data.error.code],
            details: envelope.data.error.details,
          }
        : { code: 'INTERNAL', message: ERROR_CODES.INTERNAL },
    );
  }
  return opts.schema.parse(json);
}
