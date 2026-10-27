import type { Route } from '../router.ts';
import { AuditPage } from './AuditPage.tsx';
import { PlanEditor } from './PlanEditor.tsx';
import { PlansPage } from './PlansPage.tsx';
import { ScopesPage } from './ScopesPage.tsx';
import { SettingsPage } from './SettingsPage.tsx';
import { UserDetailPage } from './UserDetailPage.tsx';
import { UsersPage } from './UsersPage.tsx';

/** The page for a route (S13: Users, user detail, Plans, plan editor, Scopes, Audit log, Settings). */
export function Page({ route }: { route: Route }) {
  switch (route.page) {
    case 'users':
      return <UsersPage />;
    case 'user':
      return <UserDetailPage key={route.id} id={route.id} />;
    case 'plans':
      return <PlansPage />;
    case 'planNew':
      return <PlanEditor id={null} />;
    case 'plan':
      return <PlanEditor key={route.id} id={route.id} />;
    case 'scopes':
      return <ScopesPage />;
    case 'audit':
      return <AuditPage />;
    case 'settings':
      return <SettingsPage />;
  }
}
