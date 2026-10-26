import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { useSession } from './api/session.ts';
import { AdminLayout } from './layout/AdminLayout.tsx';
import { Page } from './pages/Page.tsx';
import { SignInPage } from './pages/SignInPage.tsx';
import { useRoute } from './router.ts';

function Console() {
  const session = useSession();
  const route = useRoute();
  if (session.isPending) return null;
  if (!session.data) return <SignInPage />;
  return (
    <AdminLayout route={route} email={session.data.user.email}>
      <Page route={route} />
    </AdminLayout>
  );
}

/** The admin console (ADR-008, S13): sign-in, then users, audit log and settings. */
export function App() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <Console />
    </QueryClientProvider>
  );
}
