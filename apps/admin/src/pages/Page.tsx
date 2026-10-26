import type { Route } from '../router.ts';
import { AuditPage } from './AuditPage.tsx';
import { SettingsPage } from './SettingsPage.tsx';
import { UserDetailPage } from './UserDetailPage.tsx';
import { UsersPage } from './UsersPage.tsx';

/** The page for a route (S13: Users, user detail, Audit log, Settings). */
export function Page({ route }: { route: Route }) {
  switch (route.page) {
    case 'users':
      return <UsersPage />;
    case 'user':
      return <UserDetailPage key={route.id} id={route.id} />;
    case 'audit':
      return <AuditPage />;
    case 'settings':
      return <SettingsPage />;
  }
}
