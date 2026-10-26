import { useEffect, useState } from 'react';

export type Route =
  { page: 'users' } | { page: 'user'; id: string } | { page: 'audit' } | { page: 'settings' };

/** `#/users`, `#/users/<id>`, `#/audit`, `#/settings`; anything else is the users list. */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'users' && parts[1]) return { page: 'user', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'audit') return { page: 'audit' };
  if (parts[0] === 'settings') return { page: 'settings' };
  return { page: 'users' };
}

export function hrefOf(route: Route): string {
  return route.page === 'user' ? `#/users/${encodeURIComponent(route.id)}` : `#/${route.page}`;
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const changed = () => {
      setHash(window.location.hash);
    };
    window.addEventListener('hashchange', changed);
    return () => {
      window.removeEventListener('hashchange', changed);
    };
  }, []);
  return parseRoute(hash);
}
