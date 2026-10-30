import type { Settings } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BootTargetField } from '../settings/BootTargetField.tsx';
import { NEXT_BUTTON, type StepProps } from './stepProps.ts';

/** Step 4 (FR-ONB-1): where NextLevel starts — a theme or the desktop (FR-THM-5). */
export function ThemeStep({ settings, persist, next }: StepProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Settings>(settings);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-300">{t('setup.theme.intro')}</p>
      <BootTargetField
        draft={draft}
        update={(change) => {
          setDraft((current) => change(current));
        }}
      />
      <div>
        <button
          type="button"
          className={NEXT_BUTTON}
          onClick={() => {
            void persist(draft).then(next);
          }}
        >
          {t('setup.next')}
        </button>
      </div>
    </div>
  );
}
