// HyperSpin's filter pill and hint row: the user's own keys and buttons, strings via i18n.
import type { InputSettings } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { HintBar } from '../components/HintBar.tsx';
import { describeKeymap } from '../engine/intentLabels.ts';
import { HYPERSPIN_KEYMAP } from './keymap.ts';

const MENU_HINTS = ['focus-next', 'enter', 'back', 'show-help'] as const;
const GAMES_HINTS = [
  'focus-next',
  'jump-next',
  'enter',
  'tab-next',
  'random',
  'show-help',
] as const;

export function Footer({ isGames, input }: { isGames: boolean; input: InputSettings }) {
  const { t } = useTranslation();
  const hints = describeKeymap(HYPERSPIN_KEYMAP, input, isGames ? GAMES_HINTS : MENU_HINTS).map(
    (row) => ({
      keys: [row.keys[0], row.buttons[0]].filter((key): key is string => !!key),
      label: t(row.labelKey),
    }),
  );
  return (
    <div className="hs-footer">
      <HintBar hints={hints} className="hs-hints" keyClassName="hs-kbd" />
    </div>
  );
}

/** The game list's filter: ◂ name n/N ▸ (mouse steps through the tabs, as LB/RB do). */
export function FilterPill({
  label,
  index,
  total,
  onStep,
}: {
  label: string;
  index: number;
  total: number;
  onStep: (dir: 1 | -1) => void;
}) {
  const { t } = useTranslation();
  const step = (dir: 1 | -1, aria: string, glyph: string) => (
    <button
      type="button"
      className="hs-filter-step"
      aria-label={aria}
      onMouseDown={(e) => {
        e.preventDefault(); // keep the keyboard on the theme root
      }}
      onClick={() => {
        onStep(dir);
      }}
    >
      {glyph}
    </button>
  );
  return (
    <div className="hs-filter" aria-label={t('themes.hyperspin.filter')}>
      {step(-1, t('themes.hyperspin.previousFilter'), '◂')}
      <span className="hs-filter-name">{label}</span>
      <span className="hs-filter-pos">{`${String(index + 1)}/${String(total)}`}</span>
      {step(1, t('themes.hyperspin.nextFilter'), '▸')}
    </div>
  );
}
