import type { GeminiSettings, Settings } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import type { SettingsDraft } from '../form/useSettingsDraft.ts';

const INPUT =
  'w-72 rounded-md border border-white/25 bg-white/[0.07] px-2.5 py-1.5 text-xs text-white hover:border-white/40 focus-visible:border-white/60 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

function withGemini(settings: Settings, patch: Partial<GeminiSettings>): Settings {
  return {
    ...settings,
    scraper: { ...settings.scraper, gemini: { ...settings.scraper.gemini, ...patch } },
  };
}

type ToolField = keyof GeminiSettings['webTool'];

/** Settings → Scraper → Gemini options (FR-SCR-7): model, Search checking, the website tool. */
export function GeminiOptions({
  draft,
  update,
  errors,
}: Pick<SettingsDraft, 'draft' | 'update' | 'errors'>) {
  const { t } = useTranslation();
  const gemini = draft.scraper.gemini;
  const modelError = errors['scraper.gemini.model'];
  const text = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="flex items-center justify-between gap-6 text-xs text-slate-200">
      <span>{label}</span>
      <input
        type="text"
        aria-label={label}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={INPUT}
      />
    </label>
  );
  const tool = (field: ToolField) =>
    text(t(`settings.scraper.gemini.${field}`), gemini.webTool[field], (value) => {
      update((current) =>
        withGemini(current, {
          webTool: { ...current.scraper.gemini.webTool, [field]: value },
        }),
      );
    });

  return (
    <section className="flex flex-col gap-3 border-b border-white/5 py-4">
      <h3 className="text-sm font-medium text-white">{t('settings.scraper.gemini.options')}</h3>
      <div className="flex flex-col gap-1">
        {text(t('settings.scraper.gemini.model'), gemini.model, (model) => {
          update((current) => withGemini(current, { model }));
        })}
        <p className="text-xs text-slate-400">{t('settings.scraper.gemini.modelHelp')}</p>
        {modelError && <p className="text-xs text-[#ff8a80]">{t(modelError)}</p>}
      </div>
      <label className="flex items-start gap-2 text-xs text-slate-200">
        <input
          type="checkbox"
          aria-label={t('settings.scraper.gemini.grounding')}
          checked={gemini.grounding}
          onChange={(event) => {
            const grounding = event.target.checked;
            update((current) => withGemini(current, { grounding }));
          }}
          className="mt-0.5 accent-[#990033]"
        />
        <span className="flex flex-col gap-1">
          {t('settings.scraper.gemini.grounding')}
          <span className="text-slate-400">{t('settings.scraper.gemini.groundingHelp')}</span>
        </span>
      </label>
      <h4 className="pt-2 text-xs font-medium text-white">
        {t('settings.scraper.gemini.webTool')}
      </h4>
      <p className="text-xs text-slate-400">{t('settings.scraper.gemini.webToolHelp')}</p>
      {tool('python')}
      {tool('firefoxProfile')}
      {tool('driver')}
    </section>
  );
}
