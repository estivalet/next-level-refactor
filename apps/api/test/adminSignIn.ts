import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { StubPersona } from '../src/auth/stub.ts';

/** Cookies as a browser would keep them: name → value, from Set-Cookie headers. */
export class CookieJar {
  readonly values = new Map<string, string>();

  take(response: LightMyRequestResponse): void {
    for (const cookie of response.cookies) {
      if (cookie.value === '' || cookie.maxAge === 0) this.values.delete(cookie.name);
      else this.values.set(cookie.name, cookie.value);
    }
  }

  header(): string {
    return [...this.values].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

const pathOf = (location: string) => {
  const url = new URL(location, 'http://localhost:4000');
  return `${url.pathname}${url.search}`;
};

/**
 * The console's web sign-in (api-spec Auth: google/start → consent → callback) through the stub:
 * returns the cookie jar, the final redirect and the CSRF token.
 */
export async function adminSignIn(app: FastifyInstance, persona: StubPersona) {
  const jar = new CookieJar();
  const start = await app.inject({ url: '/v1/auth/google/start' });
  jar.take(start);
  const consent = await app.inject({
    url: `${pathOf(String(start.headers.location))}&login_hint=${persona}`,
  });
  const callback = await app.inject({
    url: pathOf(String(consent.headers.location)),
    headers: { cookie: jar.header() },
  });
  jar.take(callback);
  return {
    jar,
    location: String(callback.headers.location),
    csrf: jar.values.get('nl_csrf') ?? '',
    status: callback.statusCode,
  };
}

/** Headers for an admin request: the session cookie, and the CSRF header for writes. */
export function adminHeaders(session: { jar: CookieJar; csrf: string }, write = false) {
  return {
    cookie: session.jar.header(),
    ...(write ? { 'x-csrf-token': session.csrf } : {}),
  };
}
