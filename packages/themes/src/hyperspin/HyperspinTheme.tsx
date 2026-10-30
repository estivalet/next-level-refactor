// Ported from NextLevelOS src/themes/hyperspin/HyperspinTheme.tsx @ 3d530b7: input arrives as
// actions (US-C1), games are ThemeGames keyed by id, art comes from the art index, options are
// validated by useHyperspinSettings (FR-THM-4), and strings go through i18n.
import './hyperspin.css';
import { useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Background } from '../components/Background.tsx';
import { tabLabel } from '../components/gameTabs.ts';
import { KeyHelpOverlay } from '../components/KeyHelpOverlay.tsx';
import { MENU_STATUS_ROOT, MenuStatusContent } from '../components/MenuStatusContent.tsx';
import { useFilterTabs } from '../components/useFilterTabs.ts';
import { useFocusBackground } from '../components/useFocusBackground.ts';
import { useGamesLevelController } from '../components/useGamesLevelController.ts';
import { useNavigationSound } from '../components/useNavigationSound.ts';
import { useThemeRootFocus } from '../components/useThemeRootFocus.ts';
import { nodeLabel } from '../engine/levelModel.ts';
import type { Level, ThemeComponentProps } from '../engine/types.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';
import { useHostInput, useThemeInput } from '../engine/useThemeInput.ts';
import { useThemeHost, useThemeNavigation } from '../engine/useThemeNavigation.ts';
import { FilterPill, Footer } from './Chrome.tsx';
import { HyperspinWheel } from './HyperspinWheel.tsx';
import { GAMES_HELP_INTENTS, HYPERSPIN_KEYMAP, MENU_HELP_INTENTS } from './keymap.ts';
import { Stage } from './Stage.tsx';
import { useHyperspinSettings } from './useHyperspinSettings.ts';
import { useHyperspinStage } from './useHyperspinStage.ts';
import { useWheelGamesIntents } from './useWheelGamesIntents.ts';

export function HyperspinTheme({
  onExit,
  inputEnabled = true,
  active = true,
}: ThemeComponentProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const nav = useThemeNavigation();
  const art = useThemeArt();
  const input = useHostInput(useThemeHost());
  const options = useHyperspinSettings();
  const level = nav.currentLevel;
  const status = nav.state.status;
  const stackDepth = nav.state.stack.length;
  const isGames = level?.kind === 'games';
  const wheel = isGames ? options.gamesWheel : options.menuWheel;
  const [helpOpen, setHelpOpen] = useState(false);
  const listening = inputEnabled && !helpOpen;
  useThemeRootFocus(rootRef, { status, stackDepth, enabled: listening });

  const filters = useFilterTabs({ filtersInMenu: options.filtersInMenu });
  const games = useGamesLevelController({
    rootRef,
    columns: 1,
    tabs: filters.tabs,
    defaultTabId: filters.defaultTabId,
  });
  const { tabbed } = games;
  const display = tabbed.display;
  const gameFocus = Math.max(0, tabbed.displayFocus);
  const menuItems = level?.kind === 'menu' ? level.items : [];
  const menuFocus = menuItems.length ? Math.min(nav.state.focusIndex, menuItems.length - 1) : 0;
  const focusedMenuItem = level?.kind === 'menu' ? (menuItems[menuFocus] ?? null) : null;

  const stage = useHyperspinStage({
    level,
    depth: stackDepth,
    menuItems,
    focusedMenuItem,
    display,
    focusedGame: games.focusedGame,
    filtersAsGames: filters.filtersAsGames,
  });
  const { levelId } = stage;
  const wheelGames = useWheelGamesIntents({
    display,
    focus: gameFocus,
    setFocus: tabbed.setDisplayFocus,
  });

  useThemeInput({
    targetRef: rootRef,
    keymap: HYPERSPIN_KEYMAP,
    enabled: listening && !games.searchFocused,
    onToggleSearch: games.onToggleSearch,
    onIntent: (intent) => {
      if (intent === 'show-help') {
        setHelpOpen(true);
        return true;
      }
      if (intent === 'open-menu' || (intent === 'back' && stackDepth <= 1)) {
        onExit();
        return true;
      }
      if (isGames) return wheelGames.handle(intent) || games.handleIntent(intent);
      if (intent === 'enter') {
        filters.enterItem(menuFocus);
        return true;
      }
      return games.handleIntent(intent);
    },
  });

  const background = useFocusBackground({
    levelKind: level?.kind,
    focusKey: isGames ? String(games.focusedGame?.id ?? '') : (focusedMenuItem?.name ?? ''),
    games: games.games,
    systemName: level?.kind === 'games' ? level.systemName : '',
  });

  useNavigationSound({
    focusKey: isGames ? gameFocus : menuFocus,
    levelKey: `${levelId}:${tabbed.activeTabId}`,
    levelKind: level?.kind,
    muted: tabbed.search.isOpen || helpOpen || !active,
  });

  if (status !== 'ready' || !level) {
    return (
      <div ref={rootRef} tabIndex={0} className={`hs-root ${MENU_STATUS_ROOT}`}>
        <MenuStatusContent
          status={status}
          error={nav.state.error}
          onRetry={nav.retry}
          onExit={onExit}
          titleClassName="text-2xl font-bold"
          buttonClassName="hs-btn"
        />
      </div>
    );
  }

  const label = (l: Level) => (l.node ? nodeLabel(l.node, t) : l.kind === 'menu' ? l.title : '');
  const trail = nav.state.stack.slice(1).map(label).join(' › ');
  const tabIndex = Math.max(
    0,
    tabbed.tabs.findIndex((tab) => tab.id === tabbed.activeTabId),
  );
  const activeTab = tabbed.tabs[tabIndex];
  const rootStyle = {
    '--hs-wheel-width': wheel.width,
    '--hs-item-padding': wheel.padding.map((p) => `${String(p)}px`).join(' '),
  } as CSSProperties;

  return (
    <div ref={rootRef} tabIndex={0} className="hs-root" style={rootStyle}>
      <Background layers={background} paused={!active} />
      <div className="hs-shade" />
      <Stage
        item={stage.item}
        countText={stage.countText}
        flash={wheelGames.flash}
        message={stage.message}
        trail={trail}
      />
      <div className="hs-wheel-area">
        {level.kind === 'games' && (
          <FilterPill
            label={activeTab ? tabLabel(activeTab, t) : ''}
            index={tabIndex}
            total={tabbed.tabs.length}
            onStep={tabbed.cycleTab}
          />
        )}
        <HyperspinWheel
          content={
            level.kind === 'games'
              ? {
                  kind: 'games',
                  items: display,
                  tabId: tabbed.activeTabId,
                  onPlay: (g) => void games.play(g),
                }
              : { kind: 'menu', items: menuItems, onEnter: filters.enterItem }
          }
          levelId={levelId}
          depth={stackDepth}
          focusIndex={isGames ? gameFocus : menuFocus}
          onFocusChange={isGames ? tabbed.setDisplayFocus : nav.setFocus}
          wheel={wheel}
          art={art}
          pointerName={level.kind === 'games' ? level.systemName : (focusedMenuItem?.name ?? '')}
        />
      </div>
      <Footer isGames={isGames} input={input} />
      {tabbed.search.isOpen && (
        <input
          type="search"
          autoFocus
          aria-label={t('themes.common.searchLabel')}
          placeholder={t('themes.common.searchPlaceholder')}
          className="hs-search"
          {...games.searchInputProps}
        />
      )}
      <KeyHelpOverlay
        open={helpOpen}
        enabled={inputEnabled}
        onClose={() => {
          setHelpOpen(false);
          rootRef.current?.focus();
        }}
        keymap={HYPERSPIN_KEYMAP}
        input={input}
        intents={isGames ? GAMES_HELP_INTENTS : MENU_HELP_INTENTS}
        className="hs-help"
        panelClassName="hs-help-panel"
        keyClassName="hs-kbd"
      />
      {games.toast && (
        <div role="status" className="hs-toast">
          {games.toast}
        </div>
      )}
    </div>
  );
}
