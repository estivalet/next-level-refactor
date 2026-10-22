import { GAME_ART_KINDS } from '@nextlevel/shared';
import { DEFAULT_TILE_KINDS } from '@nextlevel/themes';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionRow } from './OptionRow.tsx';
import { OrderedList } from './OrderedList.tsx';

type GameArt = Record<string, string[]>;

const DEFAULT_KEY = 'default';

/** The kinds a system's game tiles use: its own list, then the `default` list, then the theme's. */
const kindsFor = (gameArt: GameArt | undefined, key: string) =>
  gameArt?.[key] ?? gameArt?.[DEFAULT_KEY] ?? DEFAULT_TILE_KINDS;

/**
 * Game art per system (FR-THM-4): the order of media kinds a theme's game tiles try, for all
 * systems (`default`) or one system. An emptied list drops that system's entry.
 */
export function GameArtField({
  id,
  label,
  fromPack,
  overridden,
  onUseDefault,
  error,
  gameArt,
  fallbackGameArt,
  systems,
  onChange,
}: {
  id: string;
  label: string;
  fromPack: boolean;
  overridden: boolean;
  onUseDefault: () => void;
  error?: string | undefined;
  /** What applies now (module, pack, user). */
  gameArt: GameArt | undefined;
  /** What applies without the user's value. */
  fallbackGameArt: GameArt | undefined;
  systems: readonly { id: string; name: string }[];
  onChange: (gameArt: GameArt | undefined) => void;
}) {
  const { t } = useTranslation();
  const [systemKey, setSystemKey] = useState(DEFAULT_KEY);
  const kindLabel = (kind: string) =>
    t(`settings.themes.options.kinds.${kind}`, { defaultValue: kind });
  const items = kindsFor(gameArt, systemKey);
  const set = (kinds: string[]) => {
    const others = Object.fromEntries(
      Object.entries(gameArt ?? {}).filter(([key]) => key !== systemKey),
    );
    const next = kinds.length > 0 ? { ...others, [systemKey]: kinds } : others;
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  return (
    <OptionRow
      id={id}
      label={label}
      defaultText={kindsFor(fallbackGameArt, systemKey).map(kindLabel).join(', ')}
      fromPack={fromPack}
      overridden={overridden}
      onUseDefault={onUseDefault}
      error={error}
    >
      <select
        aria-label={t('settings.themes.options.gameArtSystem')}
        value={systemKey}
        onChange={(event) => {
          setSystemKey(event.target.value);
        }}
        className="w-72 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
      >
        <option value={DEFAULT_KEY}>{t('settings.themes.options.allSystems')}</option>
        {systems.map((system) => (
          <option key={system.id} value={system.id}>
            {system.name}
          </option>
        ))}
      </select>
      <OrderedList
        label={label}
        items={items}
        options={GAME_ART_KINDS}
        itemLabel={kindLabel}
        onChange={set}
      />
    </OptionRow>
  );
}
