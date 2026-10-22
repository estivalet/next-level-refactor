import {
  GAME_BACKGROUND_SOURCES,
  type ArtIndex,
  type GameBackgroundSource,
  type ThemeArtOptions,
} from '@nextlevel/shared';
import {
  DEFAULT_GAME_BACKGROUND_SOURCES,
  mergeThemeArt,
  type ThemeModule,
} from '@nextlevel/themes';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '../form/Switch.tsx';
import { GameArtField } from './GameArtField.tsx';
import { OptionRow } from './OptionRow.tsx';
import { OrderedList } from './OrderedList.tsx';
import { artFolders } from './themeOptions.ts';

type SetArt = <K extends keyof ThemeArtOptions>(
  key: K,
  value: ThemeArtOptions[K] | undefined,
) => void;

/**
 * A theme's art options (FR-THM-4): logo style, background order, video backgrounds, background
 * zoom, game background order and game art per system. Each shows what applies without the
 * user's value (module, then pack).
 */
export function ArtOptions({
  theme,
  index,
  userArt,
  errors,
  systems,
  onArt,
}: {
  theme: ThemeModule;
  index: ArtIndex | undefined;
  userArt: ThemeArtOptions | undefined;
  /** Error keys by option key. */
  errors: Partial<Record<keyof ThemeArtOptions, string>>;
  systems: readonly { id: string; name: string }[];
  onArt: SetArt;
}) {
  const { t } = useTranslation();
  const id = useId();
  const packArt = index?.manifest?.art;
  const fallback = mergeThemeArt(theme.art, packArt);
  const art = mergeThemeArt(theme.art, packArt, userArt);
  const folders = artFolders(index);
  const onOff = (on: boolean) =>
    t(on ? 'settings.themes.options.on' : 'settings.themes.options.off');
  const sourceLabel = (source: string) => t(`settings.themes.options.sources.${source}`);
  const row = (key: keyof ThemeArtOptions, label: string, defaultText: string) => ({
    id: `${id}-${key}`,
    label,
    defaultText,
    fromPack: packArt?.[key] !== undefined,
    overridden: userArt?.[key] !== undefined,
    onUseDefault: () => {
      onArt(key, undefined);
    },
    error: errors[key] && t(errors[key]),
  });
  const listId = `${id}-logo-variants`;
  const games = (sources: GameBackgroundSource[] | undefined) =>
    sources ?? DEFAULT_GAME_BACKGROUND_SOURCES;

  return (
    <section className="flex flex-col">
      <h3 className="mt-4 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {t('settings.themes.options.artHeading')}
      </h3>
      <OptionRow
        {...row('logoVariant', t('settings.themes.options.logoVariant'), fallback.logoVariant)}
      >
        <input
          list={listId}
          aria-label={t('settings.themes.options.logoVariant')}
          value={art.logoVariant}
          onChange={(event) => {
            onArt('logoVariant', event.target.value);
          }}
          className="w-48 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
        />
        <datalist id={listId}>
          {folders.logoVariants.map((variant) => (
            <option key={variant} value={variant} />
          ))}
        </datalist>
      </OptionRow>
      <OptionRow
        {...row(
          'backgroundVariants',
          t('settings.themes.options.backgroundVariants'),
          fallback.backgroundVariants.join(', '),
        )}
      >
        <OrderedList
          label={t('settings.themes.options.backgroundVariants')}
          items={art.backgroundVariants}
          options={[...new Set([...art.backgroundVariants, ...folders.backgroundVariants])]}
          onChange={(items) => {
            onArt('backgroundVariants', items);
          }}
        />
      </OptionRow>
      <OptionRow
        {...row(
          'useVideoBackground',
          t('settings.themes.options.useVideoBackground'),
          onOff(fallback.useVideoBackground),
        )}
      >
        <Switch
          checked={art.useVideoBackground}
          labelledBy={`${id}-useVideoBackground-label`}
          onChange={(on) => {
            onArt('useVideoBackground', on);
          }}
        />
      </OptionRow>
      <OptionRow
        {...row(
          'backgroundZoom',
          t('settings.themes.options.backgroundZoom'),
          onOff(fallback.backgroundZoom ?? true),
        )}
      >
        <Switch
          checked={art.backgroundZoom ?? true}
          labelledBy={`${id}-backgroundZoom-label`}
          onChange={(on) => {
            onArt('backgroundZoom', on);
          }}
        />
      </OptionRow>
      <OptionRow
        {...row(
          'gameBackgroundSources',
          t('settings.themes.options.gameBackgroundSources'),
          games(fallback.gameBackgroundSources).map(sourceLabel).join(', '),
        )}
      >
        <OrderedList
          label={t('settings.themes.options.gameBackgroundSources')}
          items={games(art.gameBackgroundSources)}
          options={GAME_BACKGROUND_SOURCES}
          itemLabel={sourceLabel}
          onChange={(items) => {
            onArt('gameBackgroundSources', items as GameBackgroundSource[]);
          }}
        />
      </OptionRow>
      <GameArtField
        {...row('gameArt', t('settings.themes.options.gameArt'), '')}
        gameArt={art.gameArt}
        fallbackGameArt={fallback.gameArt}
        systems={systems}
        onChange={(gameArt) => {
          onArt('gameArt', gameArt);
        }}
      />
    </section>
  );
}
