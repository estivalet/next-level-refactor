import type { Settings } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSaveSettings, useSettings } from '../settings/settingsApi.ts';
import { DoneStep } from './DoneStep.tsx';
import { EmulatorsStep } from './EmulatorsStep.tsx';
import { FoldersStep } from './FoldersStep.tsx';
import { SystemsStep } from './SystemsStep.tsx';
import { ThemeStep } from './ThemeStep.tsx';

const STEPS = ['systems', 'folders', 'emulators', 'theme', 'done'] as const;

/**
 * The first-run wizard (FR-ONB-1, US-B2, D48): systems, game folders, emulators, look, done.
 * Each step has Back and Skip; Next saves the step. Finishing marks setup complete and says
 * where to land: the Catalog when the library is empty (FR-ONB-2), else the boot target.
 */
export function SetupWizard({ onDone }: { onDone: (landing: 'catalog' | null) => void }) {
  const { t } = useTranslation();
  const settings = useSettings();
  const save = useSaveSettings();
  const [step, setStep] = useState(0);
  const loaded = settings.data?.kind === 'ok' ? settings.data.snapshot : null;
  if (!loaded) return null;
  const persist = (next: Settings) =>
    save.mutateAsync({ settings: next, baseRevision: loaded.revision });
  const props = {
    settings: loaded.settings,
    persist,
    next: () => {
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    },
  };
  const name = STEPS[step] ?? 'done';
  const finish = (landing: 'catalog' | null) => {
    void persist({
      ...loaded.settings,
      general: { ...loaded.settings.general, setupCompletedAt: new Date().toISOString() },
    }).then(() => {
      onDone(landing);
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0b12] p-6 text-slate-200">
      <section
        aria-labelledby="setup-title"
        className="flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-white/10 bg-[#14141c] p-6 shadow-2xl"
      >
        <p className="text-xs text-slate-400">
          {t('setup.step', { n: step + 1, total: STEPS.length })}
        </p>
        <h2 id="setup-title" className="text-xl font-semibold text-white">
          {t(`setup.${name}.title`)}
        </h2>
        {name === 'systems' && <SystemsStep key={loaded.revision} {...props} />}
        {name === 'folders' && <FoldersStep {...props} />}
        {name === 'emulators' && <EmulatorsStep {...props} />}
        {name === 'theme' && <ThemeStep {...props} />}
        {name === 'done' && <DoneStep settings={loaded.settings} finish={finish} />}
        {save.isError && (
          <p role="alert" className="text-sm text-[#ff8a80]">
            {t('setup.saveFailed')}
          </p>
        )}
        <div className="flex gap-2 border-t border-white/5 pt-4">
          {step > 0 && (
            <button
              type="button"
              onClick={() => {
                setStep(step - 1);
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
            >
              {t('setup.back')}
            </button>
          )}
          {name !== 'done' && (
            <button
              type="button"
              onClick={props.next}
              className="ml-auto rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
            >
              {t('setup.skip')}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
