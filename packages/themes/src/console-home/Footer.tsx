// Console Home's footer: back and exit buttons around the focused title and the hints, split out
// of NextLevelOS src/themes/console-home/ConsoleHomeTheme.tsx @ 3d530b7.
import type { InputSettings } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { HintBar } from '../components/HintBar.tsx';
import { ArrowLeftIcon, PowerIcon } from '../components/icons.tsx';
import { describeKeymap } from '../engine/intentLabels.ts';
import { CONSOLE_HOME_KEYMAP } from './keymap.ts';

const MENU_HINTS = ['focus-next', 'enter', 'back', 'show-help'] as const;
const GAMES_HINTS = ['enter', 'tab-next', 'toggle-favorite', 'toggle-search', 'show-help'] as const;

const keepFocus = (event: { preventDefault: () => void }) => {
  // A click must not move focus off the theme root.
  event.preventDefault();
};

export function Footer({
  title,
  isGames,
  input,
  onBack,
  onExit,
}: {
  title: string;
  isGames: boolean;
  input: InputSettings;
  onBack: () => void;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const hints = describeKeymap(CONSOLE_HOME_KEYMAP, input, isGames ? GAMES_HINTS : MENU_HINTS).map(
    (row) => ({
      keys: [row.keys[0], row.buttons[0]].filter((key): key is string => !!key),
      label: t(row.labelKey),
    }),
  );
  return (
    <footer className="ch-footer">
      <button
        type="button"
        className="ch-round-btn"
        aria-label={t('themes.common.back')}
        onMouseDown={keepFocus}
        onClick={onBack}
      >
        <ArrowLeftIcon size={22} />
      </button>
      <div className="ch-footer-main">
        <div className="ch-focus-title">{title}</div>
        <HintBar hints={hints} className="ch-hints" keyClassName="ch-kbd" />
      </div>
      <button
        type="button"
        className="ch-round-btn"
        aria-label={t('themes.common.exit')}
        onMouseDown={keepFocus}
        onClick={onExit}
      >
        <PowerIcon size={22} />
      </button>
    </footer>
  );
}
