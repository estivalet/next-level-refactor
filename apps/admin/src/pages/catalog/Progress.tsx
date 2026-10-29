import { useTranslation } from 'react-i18next';

export interface Sending {
  name: string;
  loaded: number;
  total: number;
}

/** An upload under way: a labelled progress bar and its percentage. */
export function Progress({ sending }: { sending: Sending }) {
  const { t } = useTranslation();
  const percent = sending.total > 0 ? Math.floor((sending.loaded / sending.total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <progress
        aria-label={t('admin.catalog.uploading', { name: sending.name })}
        value={sending.loaded}
        max={Math.max(sending.total, 1)}
        className="h-2 w-64"
      />
      <span>{percent}%</span>
    </div>
  );
}
