import { ERROR_CODES } from '@nextlevel/shared';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const errorKey = (code: string) =>
  code in ERROR_CODES ? ERROR_CODES[code as keyof typeof ERROR_CODES] : 'errors.internal';

/** A failed load or save; a CONFLICT offers Reload (the menu changed elsewhere). */
export function DraftErrorBanner({
  code,
  conflict,
  onReload,
}: {
  code: string;
  conflict: boolean;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
    >
      <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{t(conflict ? 'menuEditor.conflict' : errorKey(code))}</span>
      {conflict && (
        <button
          type="button"
          className="ml-auto rounded-md border border-red-400/30 px-2 py-0.5 hover:bg-red-500/20"
          onClick={onReload}
        >
          {t('menuEditor.reload')}
        </button>
      )}
    </div>
  );
}
