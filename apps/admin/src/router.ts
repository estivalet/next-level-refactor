import { useEffect, useState } from 'react';

export const CATALOG_TABS = ['metadata', 'files', 'art', 'license', 'publish'] as const;
export type CatalogTab = (typeof CATALOG_TABS)[number];

export type Route =
  | { page: 'users' }
  | { page: 'user'; id: string }
  | { page: 'plans' }
  | { page: 'planNew' }
  | { page: 'plan'; id: string }
  | { page: 'scopes' }
  | { page: 'catalog' }
  | { page: 'catalogNew' }
  | { page: 'catalogItem'; id: string; tab: CatalogTab }
  | { page: 'audit' }
  | { page: 'settings' };

/**
 * `#/users`, `#/users/<id>`, `#/plans`, `#/plans/new`, `#/plans/<id>`, `#/scopes`, `#/catalog`,
 * `#/catalog/new`, `#/catalog/<id>[/<tab>]`, `#/audit`, `#/settings`; anything else is the users
 * list.
 */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'users' && parts[1]) return { page: 'user', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'plans' && parts[1] === 'new') return { page: 'planNew' };
  if (parts[0] === 'plans' && parts[1]) return { page: 'plan', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'plans') return { page: 'plans' };
  if (parts[0] === 'scopes') return { page: 'scopes' };
  if (parts[0] === 'catalog' && parts[1] === 'new') return { page: 'catalogNew' };
  if (parts[0] === 'catalog' && parts[1]) {
    const tab = CATALOG_TABS.find((name) => name === parts[2]) ?? 'metadata';
    return { page: 'catalogItem', id: decodeURIComponent(parts[1]), tab };
  }
  if (parts[0] === 'catalog') return { page: 'catalog' };
  if (parts[0] === 'audit') return { page: 'audit' };
  if (parts[0] === 'settings') return { page: 'settings' };
  return { page: 'users' };
}

export function hrefOf(route: Route): string {
  switch (route.page) {
    case 'user':
      return `#/users/${encodeURIComponent(route.id)}`;
    case 'plan':
      return `#/plans/${encodeURIComponent(route.id)}`;
    case 'planNew':
      return '#/plans/new';
    case 'catalogNew':
      return '#/catalog/new';
    case 'catalogItem':
      return `#/catalog/${encodeURIComponent(route.id)}/${route.tab}`;
    default:
      return `#/${route.page}`;
  }
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
