// Big Box List's games level wiring: header from the stack, hints from the user's bindings, S5
// tabs, search and art, around the props-driven GamesView.
import type { InputSettings } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { tabLabel } from '../components/gameTabs.ts';
import { TabBar } from '../components/TabBar.tsx';
import type { useGamesLevelController } from '../components/useGamesLevelController.ts';
import { describeKeymap } from '../engine/intentLabels.ts';
import { nodeLabel } from '../engine/levelModel.ts';
import type { Level } from '../engine/types.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';
import { GamesView } from './GamesView.tsx';
import { BBL_GAMES_KEYMAP } from './keymap.ts';
import { gamesHeader, systemNodeFor } from './systemNode.ts';

type GamesLevelData = Extract<Level, { kind: 'games' }>;
type Controller = ReturnType<typeof useGamesLevelController>;

const HINT_INTENTS = ['focus-next', 'enter', 'back', 'toggle-search', 'show-help'] as const;

export function GamesLevel({
  level,
  stack,
  controller,
  input,
  onToggleSearch,
}: {
  level: GamesLevelData;
  stack: readonly Level[];
  controller: Controller;
  input: InputSettings;
  onToggleSearch: () => void;
}) {
  const { t } = useTranslation();
  const art = useThemeArt();
  const { tabbed, focusedGame } = controller;
  const header = gamesHeader(systemNodeFor(stack), (node) => nodeLabel(node, t));
  const hints = describeKeymap(BBL_GAMES_KEYMAP, input, HINT_INTENTS).map((row) => ({
    keys: [row.keys[0], row.buttons[0]].filter((key): key is string => !!key),
    label: t(row.labelKey),
  }));
  const logo = focusedGame ? art.gameMedia(focusedGame, 'logo-clear') : null;

  return (
    <GamesView
      title={header.title}
      badge={header.badge}
      games={tabbed.display}
      focusIndex={Math.max(0, tabbed.displayFocus)}
      focusedGame={focusedGame}
      boxArtSrcs={focusedGame ? art.gameTile(focusedGame) : []}
      logoSrcs={logo ? [logo] : []}
      filterLabel={level.filter ? nodeLabel(level.node, t) : null}
      status={level.loading ? 'loading' : level.error ? 'error' : 'ready'}
      hints={hints}
      onFocusChange={tabbed.setDisplayFocus}
      onActivate={(index) => {
        const game = tabbed.display[index];
        if (game) void controller.play(game);
      }}
      onToggleSearch={onToggleSearch}
      tabs={
        <TabBar
          tabs={tabbed.tabs.map((tab) => ({
            id: tab.id,
            label: tabLabel(tab, t),
            count: tabbed.counts[tab.id] ?? 0,
          }))}
          activeId={tabbed.activeTabId}
          onChange={tabbed.selectTab}
          className="bbl-tabs"
          tabClassName="bbl-tab"
          activeTabClassName="bbl-tab--active"
        />
      }
      search={
        tabbed.search.isOpen ? (
          <input
            type="search"
            autoFocus
            aria-label={t('themes.common.searchLabel')}
            placeholder={t('themes.common.searchPlaceholder')}
            className="bigbox-search bbl-search"
            {...controller.searchInputProps}
          />
        ) : null
      }
    />
  );
}
