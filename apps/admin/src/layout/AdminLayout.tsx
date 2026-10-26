import { Button } from '@nextlevel/ui';
import { ScrollText, Settings, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSignOut } from '../api/session.ts';
import { LANGUAGES } from '../i18n.ts';
import { hrefOf, type Route } from '../router.ts';

const NAV = [
  { page: 'users', icon: Users, key: 'admin.nav.users' },
  { page: 'audit', icon: ScrollText, key: 'admin.nav.audit' },
  { page: 'settings', icon: Settings, key: 'admin.nav.settings' },
] as const;

/** The console frame (D27): sidebar navigation, language and sign-out, the page on the right. */
export function AdminLayout({
  route,
  email,
  children,
}: {
  route: Route;
  email: string;
  children: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const signOut = useSignOut();
  const current = route.page === 'user' ? 'users' : route.page;
  return (
    <div className="flex min-h-screen bg-[#0b0b0f] text-slate-300">
      <nav
        aria-label={t('admin.title')}
        className="flex w-56 shrink-0 flex-col gap-1 border-r border-white/5 bg-[#111115] p-3"
      >
        <p className="px-2 py-3 text-sm font-semibold text-white">{t('admin.title')}</p>
        {NAV.map(({ page, icon: Icon, key }) => (
          <a
            key={page}
            href={hrefOf({ page })}
            aria-current={current === page ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5 ${current === page ? 'bg-white/10 text-white' : ''}`}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {t(key)}
          </a>
        ))}
        <div className="mt-auto flex flex-col gap-2 px-2 pt-4 text-xs">
          <p className="truncate text-slate-500">{email}</p>
          <label className="flex items-center gap-2">
            {t('admin.language')}
            <select
              value={i18n.language}
              onChange={(event) => {
                void i18n.changeLanguage(event.target.value);
              }}
              className="rounded bg-black/30 px-1 py-0.5"
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={() => {
              signOut.mutate();
            }}
          >
            {t('admin.nav.signOut')}
          </Button>
        </div>
      </nav>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
