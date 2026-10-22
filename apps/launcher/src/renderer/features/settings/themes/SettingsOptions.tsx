import { themeSettingsSchema, type ThemeManifest, type WheelOptions } from '@nextlevel/shared';
import {
  mergeThemeSettings,
  parseMenuWheelSettings,
  parseWheelSettings,
  type ThemeModule,
} from '@nextlevel/themes';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '../form/Switch.tsx';
import { OptionRow } from './OptionRow.tsx';
import { WheelFields } from './WheelFields.tsx';

type Values = Record<string, unknown>;
const asWheel = (value: unknown): WheelOptions =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/**
 * A theme's own `settings` (FR-THM-4), shown only for the keys its schema has: filters in the
 * menu (HyperSpin, Showcase) and HyperSpin's game list and menu wheels.
 */
export function SettingsOptions({
  theme,
  manifest,
  userSettings,
  errors,
  onSetting,
  onWheel,
}: {
  theme: ThemeModule;
  manifest: ThemeManifest | null | undefined;
  userSettings: Values | undefined;
  /** Error message keys by dotted path under the theme's `settings`. */
  errors: Record<string, string>;
  onSetting: (key: string, value: unknown) => void;
  onWheel: <K extends keyof WheelOptions>(
    wheel: 'wheel' | 'menuWheel',
    key: K,
    value: WheelOptions[K] | undefined,
  ) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const schema = themeSettingsSchema(theme.id);
  if (!schema) return null;
  const keys = Object.keys(schema.shape);
  const fallback = mergeThemeSettings(theme.settings, manifest?.settings);
  const current = mergeThemeSettings(theme.settings, manifest?.settings, userSettings);
  const wheelErrors = (wheel: string) => {
    const out: Record<string, string> = {};
    for (const [path, key] of Object.entries(errors)) {
      const [head, field] = path.split('.');
      if (head === wheel && field) out[field] ??= key;
    }
    return out;
  };

  return (
    <section className="flex flex-col">
      <h3 className="mt-6 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {t('settings.themes.options.settingsHeading')}
      </h3>
      {keys.includes('filtersInMenu') && (
        <OptionRow
          id={`${id}-filters`}
          label={t('settings.themes.options.filtersInMenu')}
          defaultText={t(
            fallback['filtersInMenu'] === true
              ? 'settings.themes.options.on'
              : 'settings.themes.options.off',
          )}
          fromPack={manifest?.settings?.['filtersInMenu'] !== undefined}
          overridden={userSettings?.['filtersInMenu'] !== undefined}
          onUseDefault={() => {
            onSetting('filtersInMenu', undefined);
          }}
          error={errors['filtersInMenu'] && t(errors['filtersInMenu'])}
        >
          <Switch
            checked={current['filtersInMenu'] === true}
            labelledBy={`${id}-filters-label`}
            onChange={(on) => {
              onSetting('filtersInMenu', on);
            }}
          />
        </OptionRow>
      )}
      {keys.includes('wheel') && (
        <WheelFields
          label={t('settings.themes.options.wheel')}
          values={asWheel(userSettings?.['wheel'])}
          placeholder={parseWheelSettings(fallback['wheel']).value}
          errors={wheelErrors('wheel')}
          onChange={(key, value) => {
            onWheel('wheel', key, value);
          }}
        />
      )}
      {keys.includes('menuWheel') && (
        <WheelFields
          label={t('settings.themes.options.menuWheel')}
          values={asWheel(userSettings?.['menuWheel'])}
          placeholder={parseMenuWheelSettings(current['wheel'], fallback['menuWheel']).value}
          errors={wheelErrors('menuWheel')}
          onChange={(key, value) => {
            onWheel('menuWheel', key, value);
          }}
        />
      )}
    </section>
  );
}
