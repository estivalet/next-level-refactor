import {
  ApiErrorEnvelopeSchema,
  DeviceSchema,
  EntitlementResponseSchema,
  LauncherConfigSchema,
  SessionResponseSchema,
  TokenPairSchema,
  type CompleteRequest,
  type Device,
  type EntitlementResponse,
  type ErrorCode,
  type ExchangeRequest,
  type LauncherConfig,
  type RefreshRequest,
  type SessionResponse,
  type TokenPair,
} from '@nextlevel/shared';
import { z } from 'zod';

/**
 * `offline`: the API could not be used (no network, timeout, 5xx, 429, an unexpected body) —
 * the launcher keeps running on its grace period. `api`: the API answered with an error.
 */
export type Failure =
  { kind: 'offline' } | { kind: 'api'; status: number; code: ErrorCode; details: unknown };

export class ApiFailure extends Error {
  readonly failure: Failure;
  constructor(failure: Failure) {
    // Never the request: it may carry tokens.
    super(failure.kind === 'api' ? `API ${String(failure.status)} ${failure.code}` : 'API offline');
    this.name = 'ApiFailure';
    this.failure = failure;
  }
}

const offline = () => new ApiFailure({ kind: 'offline' });

/** Main's HTTP client for the NextLevel API (api-spec §2); the renderer never calls the API. */
export class ApiClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(opts: { baseUrl: string; fetch: typeof fetch; timeoutMs: number }) {
    this.#baseUrl = opts.baseUrl;
    this.#fetch = opts.fetch;
    this.#timeoutMs = opts.timeoutMs;
  }

  launcherConfig(): Promise<LauncherConfig> {
    return this.#call('GET', '/v1/auth/launcher-config', LauncherConfigSchema);
  }

  exchange(body: ExchangeRequest): Promise<SessionResponse> {
    return this.#call('POST', '/v1/auth/google/exchange', SessionResponseSchema, { body });
  }

  complete(body: CompleteRequest): Promise<SessionResponse> {
    return this.#call('POST', '/v1/auth/complete', SessionResponseSchema, { body });
  }

  refresh(body: RefreshRequest): Promise<TokenPair> {
    return this.#call('POST', '/v1/auth/refresh', TokenPairSchema, { body });
  }

  logout(refreshToken: string): Promise<void> {
    return this.#call('POST', '/v1/auth/logout', null, { body: { refreshToken } });
  }

  entitlement(access: string): Promise<EntitlementResponse> {
    return this.#call('GET', '/v1/me/entitlement', EntitlementResponseSchema, { access });
  }

  devices(access: string): Promise<Device[]> {
    return this.#call('GET', '/v1/me/devices', z.array(DeviceSchema), { access });
  }

  revokeDevice(access: string, deviceId: string): Promise<void> {
    const path = `/v1/me/devices/${encodeURIComponent(deviceId)}`;
    return this.#call('DELETE', path, null, { access });
  }

  async #call<T>(
    method: string,
    path: string,
    schema: z.ZodType<T> | null,
    opts: { body?: unknown; access?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (opts.access) headers['authorization'] = `Bearer ${opts.access}`;
    // A timer (not AbortSignal.timeout) so a hung request is bounded the same way in tests.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.#timeoutMs);
    let response: Response;
    let text: string;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        method,
        headers,
        ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
        signal: controller.signal,
      });
      text = await response.text();
    } catch {
      throw offline();
    } finally {
      clearTimeout(timer);
    }
    if (response.status >= 500 || response.status === 429) throw offline();
    const json = parse(text);
    if (!response.ok) {
      const envelope = ApiErrorEnvelopeSchema.safeParse(json);
      if (!envelope.success) throw offline();
      const { code, details } = envelope.data.error;
      throw new ApiFailure({ kind: 'api', status: response.status, code, details });
    }
    if (schema === null) return undefined as T;
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw offline();
    return parsed.data;
  }
}

function parse(text: string): unknown {
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
