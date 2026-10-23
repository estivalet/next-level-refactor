// Showcase's games level over the games controller: tabs with counts, the settled game's video,
// system logo and filter label, cover art (FR-THM-1, FR-THM-2).
import { gameById } from '../engine/gameIndex.ts';
import { useTranslation } from 'react-i18next';
import { tabLabel } from '../components/gameTabs.ts';
import type { useGamesLevelController } from '../components/useGamesLevelController.ts';
import { useSettledFocus } from '../components/useSettledFocus.ts';
import type { Level } from '../engine/types.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';
import { useThemeNavigation } from '../engine/useThemeNavigation.ts';
import { GamesView } from './GamesView.tsx';

type Controller = ReturnType<typeof useGamesLevelController>;

export function ShowcaseGames({
  level,
  title,
  controller,
  active,
}: {
  level: Extract<Level, { kind: 'games' }>;
  title: string;
  controller: Controller;
  active: boolean;
}) {
  const { t } = useTranslation();
  const art = useThemeArt();
  const nav = useThemeNavigation();
  const { tabbed, focusedGame } = controller;
  // The video follows the settled game; reset on level change so the next system never
  // inherits the previous one's video.
  const settledId = useSettledFocus(focusedGame?.id ?? 0, 400, nav.state.stack.length);
  const settled = gameById(tabbed.display, settledId);
  const video = active && settled ? art.gameMedia(settled, 'video') : null;
  const isFilter = level.node.type === 'filter';

  return (
    <GamesView
      title={title}
      // A filter level ("Official", "Homebrew"…) has no logo of its own: show its system's
      // logo, and the filter's name as text under it. Filter nodes carry the system's name.
      systemLogo={art.logo(level.node.name)}
      systemName={level.node.name}
      filterLabel={isFilter ? title : undefined}
      game={focusedGame}
      videoCandidates={video ? [video] : []}
      videoFor={settled?.id ?? null}
      tabs={tabbed.tabs.map((tab) => ({
        id: tab.id,
        label: tabLabel(tab, t),
        count: tabbed.counts[tab.id] ?? 0,
      }))}
      activeTabId={tabbed.activeTabId}
      onSelectTab={tabbed.selectTab}
      display={tabbed.display}
      displayFocus={tabbed.displayFocus}
      onFocusChange={tabbed.setDisplayFocus}
      onActivate={(i) => {
        const game = tabbed.display[i];
        if (game) void controller.play(game);
      }}
      artCandidates={art.gameTile}
      loading={level.loading}
      error={level.error}
    />
  );
}
