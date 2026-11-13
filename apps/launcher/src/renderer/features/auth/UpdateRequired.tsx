import { useTranslation } from 'react-i18next';
import { UpdatePanel } from '../update/UpdatePanel.tsx';
import { GateFrame } from './GateFrame.tsx';

/**
 * The API needs a newer launcher (`426 UPDATE_REQUIRED`, NFR-UPD-1): Update now on installed
 * copies, the download page on zip copies. The sign-in is kept, so the updated launcher goes
 * straight back in.
 */
export function UpdateRequired({ banner }: { banner: string | null }) {
  const { t } = useTranslation();
  return (
    <GateFrame title={t('auth.updateRequired.title')} banner={banner}>
      <p className="text-sm text-slate-300">{t('auth.updateRequired.body')}</p>
      <UpdatePanel checkLabel={t('auth.updateRequired.updateNow')} autoFocus />
    </GateFrame>
  );
}
