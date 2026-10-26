import type { Route } from '../router.ts';

/** The page for a route (filled by the users, audit and settings pages). */
export function Page({ route }: { route: Route }) {
  return <p className="text-sm text-slate-500">{route.page}</p>;
}
