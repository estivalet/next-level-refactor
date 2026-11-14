import { useTranslation } from 'react-i18next';

/** The whole renderer crashed (NFR-REL-2): reload it; main and the library keep running. */
export function ShellCrash() {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#11131a] text-white"
    >
      <h1 className="text-lg font-semibold">{t('shell.crash.title')}</h1>
      <button
        type="button"
        autoFocus
        onClick={() => {
          window.location.reload();
        }}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold hover:bg-sky-500"
      >
        {t('shell.crash.reload')}
      </button>
    </div>
  );
}
