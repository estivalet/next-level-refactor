import { useTranslation } from 'react-i18next';

/** A desktop window whose app crashed (NFR-REL-2): the title bar still closes it. */
export function WindowCrash({ onReload }: { onReload: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm"
    >
      <p>{t('shell.window.crash')}</p>
      <button
        type="button"
        onClick={onReload}
        className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-500"
      >
        {t('shell.window.reload')}
      </button>
    </div>
  );
}
