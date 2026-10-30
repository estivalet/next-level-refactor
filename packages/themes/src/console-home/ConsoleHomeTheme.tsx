// Ported from NextLevelOS src/themes/console-home/ConsoleHomeTheme.tsx @ 3d530b7: input arrives as
// actions (US-C1), menu items are MenuNodes, hints show the user's own keys and buttons, and
// strings go through i18n.
import './console-home.css';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Background } from '../components/Background.tsx';
import { cn } from '../components/cn.ts';
import { KeyHelpOverlay } from '../components/KeyHelpOverlay.tsx';
import { MENU_STATUS_ROOT, MenuStatusContent } from '../components/MenuStatusContent.tsx';
import { StatusBar } from '../components/StatusBar.tsx';
import { useFocusBackground } from '../components/useFocusBackground.ts';
import { useGamesLevelController } from '../components/useGamesLevelController.ts';
import { levelIdentity, useNavigationSound } from '../components/useNavigationSound.ts';
import { useThemeRootFocus } from '../components/useThemeRootFocus.ts';
import { nodeLabel } from '../engine/levelModel.ts';
import { levelPush } from '../engine/transitions.ts';
import type { Level, NavIntentKind, ThemeComponentProps } from '../engine/types.ts';
import { useFilterLayout } from '../engine/useFilterLayout.ts';
import { useHostInput, useThemeInput } from '../engine/useThemeInput.ts';
import { useThemeHost, useThemeNavigation } from '../engine/useThemeNavigation.ts';
import { Footer } from './Footer.tsx';
import { GamesView, GRID_COLUMNS, PAGE_ROWS } from './GamesView.tsx';
import { CONSOLE_HOME_KEYMAP, GAMES_HELP_INTENTS, MENU_HELP_INTENTS } from './keymap.ts';
import { MenuView } from './MenuView.tsx';

export function ConsoleHomeTheme({
  onExit,
  inputEnabled = true,
  active = true,
}: ThemeComponentProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const nav = useThemeNavigation();
  const input = useHostInput(useThemeHost());
  useFilterLayout(true); // a system's filters are entries in the systems menu
  const level = nav.currentLevel;
  const status = nav.state.status;
  const stackDepth = nav.state.stack.length;
  const [helpOpen, setHelpOpen] = useState(false);
  const listening = inputEnabled && !helpOpen;
  useThemeRootFocus(rootRef, { status, stackDepth, enabled: listening });

  const games = useGamesLevelController({
    rootRef,
    columns: GRID_COLUMNS,
    pageSize: GRID_COLUMNS * PAGE_ROWS,
  });
  const { tabbed, focusedGame } = games;
  const isGames = level?.kind === 'games';
  const menuItems = level?.kind === 'menu' ? level.items : [];
  const menuFocus = menuItems.length ? Math.min(nav.state.focusIndex, menuItems.length - 1) : 0;
  const focusedMenuItem = level?.kind === 'menu' ? (menuItems[menuFocus] ?? null) : null;

  useThemeInput({
    targetRef: rootRef,
    keymap: CONSOLE_HOME_KEYMAP,
    enabled: listening && !games.searchFocused,
    onToggleSearch: games.onToggleSearch,
    onIntent: (intent: NavIntentKind) => {
      if (intent === 'show-help') {
        setHelpOpen(true);
        return true;
      }
      if (intent === 'open-menu') {
        onExit();
        return true;
      }
      return games.handleIntent(intent); // menu: false → built-in prev/next/enter/back/home
    },
  });

  const background = useFocusBackground({
    levelKind: level?.kind,
    focusKey: isGames ? String(focusedGame?.id ?? '') : (focusedMenuItem?.name ?? ''),
    games: games.games,
    systemName: level?.kind === 'games' ? level.systemName : '',
  });

  useNavigationSound({
    focusKey: isGames ? tabbed.displayFocus : menuFocus,
    levelKey: `${String(stackDepth)}:${levelIdentity(level)}:${tabbed.activeTabId}`,
    levelKind: level?.kind,
    muted: tabbed.search.isOpen || helpOpen || !active,
  });

  if (status !== 'ready' || !level) {
    return (
      <div ref={rootRef} tabIndex={0} className={`ch-root ${MENU_STATUS_ROOT}`}>
        <MenuStatusContent
          status={status}
          error={nav.state.error}
          onRetry={nav.retry}
          onExit={onExit}
          titleClassName="font-bold"
          buttonClassName="ch-round-btn w-auto px-5"
        />
      </div>
    );
  }

  const label = (l: Level) => (l.node ? nodeLabel(l.node, t) : l.kind === 'menu' ? l.title : '');
  const levelTitle = label(level);
  const trail = nav.state.stack.slice(1).map(label).join(' › ');
  const footerTitle = isGames
    ? (focusedGame?.title ?? levelTitle)
    : focusedMenuItem
      ? nodeLabel(focusedMenuItem, t)
      : levelTitle;

  return (
    <div ref={rootRef} tabIndex={0} className={cn('ch-root', isGames && 'ch-games-mode')}>
      <div className="ch-bg">
        <Background layers={background} paused={!active} />
      </div>
      <div className="ch-frost" />

      <StatusBar
        className="ch-status"
        clockClassName="ch-clock"
        right={<span className="ch-breadcrumb">{trail || levelTitle}</span>}
      />

      <AnimatePresence>
        <motion.div
          key={stackDepth}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          // The exiting level stays mounted during the crossfade; it must not be clickable.
          exit={{ opacity: 0, scale: 0.985, pointerEvents: 'none' }}
          transition={levelPush}
          className="absolute inset-0"
        >
          {level.kind === 'menu' ? (
            <MenuView
              items={menuItems}
              focusIndex={menuFocus}
              onFocusChange={nav.setFocus}
              onEnter={nav.enter}
            />
          ) : (
            <GamesView
              title={levelTitle}
              controller={games}
              loading={level.loading}
              error={level.error}
              onBack={nav.back}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <Footer
        title={footerTitle}
        isGames={isGames}
        input={input}
        onBack={nav.back}
        onExit={onExit}
      />

      {tabbed.search.isOpen && (
        <input
          type="search"
          autoFocus
          aria-label={t('themes.common.searchLabel')}
          placeholder={t('themes.common.searchPlaceholder')}
          className="ch-search"
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
        keymap={CONSOLE_HOME_KEYMAP}
        input={input}
        intents={isGames ? GAMES_HELP_INTENTS : MENU_HELP_INTENTS}
        className="ch-help"
        panelClassName="ch-help-panel"
        keyClassName="ch-kbd"
      />

      {games.toast && (
        <div role="status" className="ch-toast">
          {games.toast}
        </div>
      )}
    </div>
  );
}
