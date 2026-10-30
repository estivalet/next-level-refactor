// Ported from NextLevelOS src/themes/ps5/Ps5Theme.tsx @ 3d530b7: input arrives as actions (US-C1),
// categories are the root MenuNodes, hints show the user's own keys and buttons, strings via i18n.
import './ps5.css';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Background } from '../components/Background.tsx';
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
import { GamesView, PS5_GRID_COLUMNS, PS5_PAGE_ROWS } from './GamesView.tsx';
import { HomeView } from './HomeView.tsx';
import { GAMES_HELP_INTENTS, HOME_HELP_INTENTS, PS5_KEYMAP } from './keymap.ts';

export function Ps5Theme({ onExit, inputEnabled = true, active = true }: ThemeComponentProps) {
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
    columns: PS5_GRID_COLUMNS,
    pageSize: PS5_GRID_COLUMNS * PS5_PAGE_ROWS,
  });

  // Categories: the root's items, always one selected.
  const root = nav.state.stack[0];
  const categories = root?.kind === 'menu' ? root.items : [];
  const activeCategory = root?.kind === 'menu' ? root.lastFocusIndex : 0;
  const { selectRoot } = nav;
  // Whenever only the root is on the stack (mount, home, a switch from another theme at the
  // root), select its remembered category so the home always shows a category's items.
  useEffect(() => {
    if (status !== 'ready' || stackDepth !== 1 || categories.length === 0) return;
    selectRoot(Math.min(activeCategory, categories.length - 1));
  }, [status, stackDepth, categories.length, activeCategory, selectRoot]);

  const isGames = level?.kind === 'games';
  const menuItems = level?.kind === 'menu' ? level.items : [];
  const menuFocus = menuItems.length ? Math.min(nav.state.focusIndex, menuItems.length - 1) : 0;
  const focusedMenuItem = level?.kind === 'menu' ? (menuItems[menuFocus] ?? null) : null;

  useThemeInput({
    targetRef: rootRef,
    keymap: PS5_KEYMAP,
    enabled: listening && !games.searchFocused,
    onToggleSearch: games.onToggleSearch,
    onIntent: (intent: NavIntentKind) => {
      if (intent === 'show-help') {
        setHelpOpen(true);
        return true;
      }
      // Leaving the category depth opens the theme menu (the bare root would just re-select the
      // same category). An open search closes first.
      const searchOpen = isGames && games.tabbed.search.isOpen;
      if (intent === 'open-menu' || (intent === 'back' && stackDepth <= 2 && !searchOpen)) {
        onExit();
        return true;
      }
      if (games.handleIntent(intent)) return true;
      if (!isGames && (intent === 'tab-prev' || intent === 'tab-next')) {
        const n = categories.length;
        if (n > 0) selectRoot((activeCategory + (intent === 'tab-next' ? 1 : -1) + n) % n);
        return true;
      }
      return false;
    },
  });

  // Background on the home only; the games level has its own dark backdrop.
  const background = useFocusBackground({
    levelKind: level?.kind,
    focusKey: focusedMenuItem?.name ?? '',
    games: games.games,
    systemName: level?.kind === 'games' ? level.systemName : '',
  });

  useNavigationSound({
    focusKey: isGames ? games.tabbed.displayFocus : menuFocus,
    levelKey: `${String(stackDepth)}:${String(activeCategory)}:${levelIdentity(level)}:${games.tabbed.activeTabId}`,
    levelKind: level?.kind,
    muted: games.tabbed.search.isOpen || helpOpen || !active,
  });

  // At the bare root (before the effect above selects a category) show the loading state instead
  // of flashing the category list as a shelf.
  const selecting = status === 'ready' && stackDepth === 1 && categories.length > 0;
  if (status !== 'ready' || selecting || !level) {
    return (
      <div ref={rootRef} tabIndex={0} className={`ps5-root ${MENU_STATUS_ROOT}`}>
        <MenuStatusContent
          status={selecting ? 'loading' : status}
          error={nav.state.error}
          onRetry={nav.retry}
          onExit={onExit}
          titleClassName="font-bold"
          buttonClassName="ps5-explore"
        />
      </div>
    );
  }

  const label = (l: Level) => (l.node ? nodeLabel(l.node, t) : l.kind === 'menu' ? l.title : '');
  const trail = nav.state.stack.slice(2).map(label).join(' › ');

  return (
    <div ref={rootRef} tabIndex={0} className="ps5-root">
      {!isGames && (
        <>
          <Background layers={background} paused={!active} />
          <div className="ps5-shade" />
        </>
      )}

      <AnimatePresence>
        <motion.div
          key={`${level.kind}-${String(stackDepth)}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={levelPush}
          className="absolute inset-0"
        >
          {level.kind === 'menu' ? (
            <HomeView
              categories={categories}
              activeCategory={activeCategory}
              onSelectCategory={selectRoot}
              trail={trail}
              clock={<StatusBar showClock clockClassName="ps5-clock" />}
              items={menuItems}
              focusIndex={menuFocus}
              onFocusChange={nav.setFocus}
              onActivate={nav.enter}
            />
          ) : (
            <GamesView title={label(level)} level={level} controller={games} />
          )}
        </motion.div>
      </AnimatePresence>

      <Footer isGames={isGames} input={input} />

      {games.tabbed.search.isOpen && (
        <input
          type="search"
          autoFocus
          aria-label={t('themes.common.searchLabel')}
          placeholder={t('themes.common.searchPlaceholder')}
          className="ps5-search"
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
        keymap={PS5_KEYMAP}
        input={input}
        intents={isGames ? GAMES_HELP_INTENTS : HOME_HELP_INTENTS}
        className="ps5-help"
        panelClassName="ps5-help-panel"
        keyClassName="ps5-kbd"
      />

      {games.toast && (
        <div role="status" className="ps5-toast">
          {games.toast}
        </div>
      )}
    </div>
  );
}
