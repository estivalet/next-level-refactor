import { useTranslation } from 'react-i18next';

/** The console's sign-in: the API runs the Google redirect flow; errors come back as ?error=. */
export function SignInPage() {
  const { t } = useTranslation();
  const error = new URLSearchParams(window.location.search).get('error');
  const message =
    error && ['notAdmin', 'cancelled', 'expired', 'failed'].includes(error)
      ? t(`admin.signIn.${error}`)
      : null;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#1e1b4b] p-6 text-slate-200">
      <section className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-[#1a1c23]/95 p-8 shadow-2xl">
        <p className="text-sm font-bold tracking-[0.3em] text-slate-400">NEXTLEVEL</p>
        <h1 className="text-xl font-semibold text-white">{t('admin.signIn.title')}</h1>
        {message && (
          <p role="alert" className="text-sm text-[#ff8a80]">
            {message}
          </p>
        )}
        <a
          href="/v1/auth/google/start"
          className="rounded-lg bg-[#990033] px-4 py-2 text-center text-sm font-medium text-white hover:bg-[#b3003c] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          {t('admin.signIn.button')}
        </a>
      </section>
    </main>
  );
}
