// Showcase's hint row: the user's own keys and buttons for the level's main actions.
import type { InputSettings } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { HintBar } from '../components/HintBar.tsx';
import { describeKeymap } from '../engine/intentLabels.ts';
import { SHOWCASE_KEYMAP } from './keymap.ts';

const HOME_HINTS = ['focus-next', 'enter', 'tab-next', 'show-help'] as const;
const GAMES_HINTS = ['enter', 'tab-next', 'toggle-favorite', 'toggle-search', 'show-help'] as const;

export function Footer({ isGames, input }: { isGames: boolean; input: InputSettings }) {
  const { t } = useTranslation();
  const hints = describeKeymap(SHOWCASE_KEYMAP, input, isGames ? GAMES_HINTS : HOME_HINTS).map(
    (row) => ({
      keys: [row.keys[0], row.buttons[0]].filter((key): key is string => !!key),
      label: t(row.labelKey),
    }),
  );
  return (
    <div className="sc-footer">
      <HintBar hints={hints} className="sc-hints" keyClassName="sc-kbd" />
    </div>
  );
}
