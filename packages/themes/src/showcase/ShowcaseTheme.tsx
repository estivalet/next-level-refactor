// Ported from NextLevelOS src/themes/showcase/ShowcaseTheme.tsx @ 3d530b7: input arrives as
// actions (US-C1), categories are the root MenuNodes, games are ThemeGames keyed by id, art and
// system descriptions come from the art index (FR-THM-2), strings go through i18n.
import './showcase.css';
import './showcase-games.css';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Background } from '../components/Background.tsx';
import { KeyHelpOverlay } from '../components/KeyHelpOverlay.tsx';
import { MENU_STATUS_ROOT, MenuStatusContent } from '../components/MenuStatusContent.tsx';
import { StatusBar } from '../components/StatusBar.tsx';
import { parseFiltersInMenu, useFilterTabs } from '../components/useFilterTabs.ts';
import { useFocusBackground } from '../components/useFocusBackground.ts';
import { countLabel, useGameCount } from '../components/useGameCount.ts';
import { useGamesLevelController } from '../components/useGamesLevelController.ts';
import { levelIdentity, useNavigationSound } from '../components/useNavigationSound.ts';
import { useSystemInfo } from '../components/useSystemInfo.ts';
import { useThemeRootFocus } from '../components/useThemeRootFocus.ts';
import { nodeLabel } from '../engine/levelModel.ts';
import { backgroundImagePaths } from '../engine/themeArt.ts';
import { levelPush } from '../engine/transitions.ts';
import type { Level, ThemeComponentProps } from '../engine/types.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';
import { useHostInput, useThemeInput } from '../engine/useThemeInput.ts';
import { useThemeHost, useThemeNavigation } from '../engine/useThemeNavigation.ts';
import { useThemeSettings } from '../engine/useThemeSettings.ts';
import { Footer } from './Footer.tsx';
import { HomeView } from './HomeView.tsx';
import { GAMES_HELP_INTENTS, HOME_HELP_INTENTS, SHOWCASE_KEYMAP } from './keymap.ts';
import { ShowcaseGames } from './ShowcaseGames.tsx';

/** The cover strip is one row: up/down never move. */
const ONE_ROW = Number.MAX_SAFE_INTEGER;
/** Covers one page jump moves (D5): about one screen of the strip. */
const PAGE_SIZE = 6;

export function ShowcaseTheme({ onExit, inputEnabled = true, active = true }: ThemeComponentProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const nav = useThemeNavigation();
  const art = useThemeArt();
  const input = useHostInput(useThemeHost());
  const level = nav.currentLevel;
  const status = nav.state.status;
  const stackDepth = nav.state.stack.length;
  const [helpOpen, setHelpOpen] = useState(false);
  const listening = inputEnabled && !helpOpen;
  useThemeRootFocus(rootRef, { status, stackDepth, enabled: listening });

  // settings.filtersInMenu (FR-THM-4): false (default) = a system's filters are game-list tabs.
  const { filtersInMenu: rawFilters } = useThemeSettings();
  const parsed = useMemo(() => parseFiltersInMenu(rawFilters, false), [rawFilters]);
  useEffect(() => {
    if (parsed.warning) console.warn('[showcase settings] invalid values ignored: filtersInMenu');
  }, [parsed.warning]);
  const filters = useFilterTabs({ filtersInMenu: parsed.value });
  const games = useGamesLevelController({
    rootRef,
    columns: ONE_ROW,
    wrap: true,
    pageSize: PAGE_SIZE,
    tabs: filters.tabs,
    defaultTabId: filters.defaultTabId,
  });

  // Categories: the root's items, always one selected (as in PS5 Style).
  const root = nav.state.stack[0];
  const categories = root?.kind === 'menu' ? root.items : [];
  const activeCategory = root?.kind === 'menu' ? root.lastFocusIndex : 0;
  const { selectRoot } = nav;
  useEffect(() => {
    if (status !== 'ready' || stackDepth !== 1 || categories.length === 0) return;
    selectRoot(Math.min(activeCategory, categories.length - 1));
  }, [status, stackDepth, categories.length, activeCategory, selectRoot]);

  const isGames = level?.kind === 'games';
  const menuItems = level?.kind === 'menu' ? level.items : [];
  const menuFocus = menuItems.length ? Math.min(nav.state.focusIndex, menuItems.length - 1) : 0;
  const focusedMenuItem = level?.kind === 'menu' ? (menuItems[menuFocus] ?? null) : null;
  const count = useGameCount(focusedMenuItem, 250, { filtersAsGames: filters.filtersAsGames });
  const info = useSystemInfo(focusedMenuItem?.name ?? null);

  useThemeInput({
    targetRef: rootRef,
    keymap: SHOWCASE_KEYMAP,
    enabled: listening && !games.searchFocused,
    onToggleSearch: games.onToggleSearch,
    onIntent: (intent) => {
      if (intent === 'show-help') {
        setHelpOpen(true);
        return true;
      }
      // Leaving the category depth opens the theme menu. An open search closes first.
      const searchOpen = isGames && games.tabbed.search.isOpen;
      if (intent === 'open-menu' || (intent === 'back' && stackDepth <= 2 && !searchOpen)) {
        onExit();
        return true;
      }
      if (!isGames && intent === 'enter') {
        filters.enterItem(menuFocus);
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

  const background = useFocusBackground({
    levelKind: level?.kind,
    focusKey: isGames ? String(games.focusedGame?.id ?? '') : (focusedMenuItem?.name ?? ''),
    games: games.games,
    systemName: level?.kind === 'games' ? level.node.name : '',
  });

  useNavigationSound({
    focusKey: isGames ? games.tabbed.displayFocus : menuFocus,
    levelKey: `${String(stackDepth)}:${String(activeCategory)}:${levelIdentity(level)}:${games.tabbed.activeTabId}`,
    levelKind: level?.kind,
    muted: games.tabbed.search.isOpen || helpOpen || !active,
  });

  // At the bare root (before the effect above selects a category) show the loading state.
  const selecting = status === 'ready' && stackDepth === 1 && categories.length > 0;
  if (status !== 'ready' || selecting || !level) {
    return (
      <div ref={rootRef} tabIndex={0} className={`sc-root ${MENU_STATUS_ROOT}`}>
        <MenuStatusContent
          status={selecting ? 'loading' : status}
          error={nav.state.error}
          onRetry={nav.retry}
          onExit={onExit}
          titleClassName="text-2xl font-bold"
          buttonClassName="sc-button"
        />
      </div>
    );
  }

  const label = (l: Level) => (l.node ? nodeLabel(l.node, t) : l.kind === 'menu' ? l.title : '');
  const trail = nav.state.stack.slice(2).map(label).join(' › ');

  return (
    <div ref={rootRef} tabIndex={0} className="sc-root">
      <Background layers={background} paused={!active} />
      <div className={isGames ? 'sc-shade sc-shade--games' : 'sc-shade'} />
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
              clock={<StatusBar showClock clockClassName="sc-clock" />}
              items={menuItems}
              focusIndex={menuFocus}
              onFocusChange={nav.setFocus}
              onActivate={filters.enterItem}
              imageCandidates={(name) => art.urls(backgroundImagePaths(name, art.config))}
              logoCandidates={art.logo}
              hardwareCandidates={art.hardware}
              description={info.description}
              countText={countLabel(count, t)}
            />
          ) : (
            <ShowcaseGames level={level} title={label(level)} controller={games} active={active} />
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
          className="sc-search"
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
        keymap={SHOWCASE_KEYMAP}
        input={input}
        intents={isGames ? GAMES_HELP_INTENTS : HOME_HELP_INTENTS}
        className="sc-help"
        panelClassName="sc-help-panel"
        keyClassName="sc-kbd"
      />
      {games.toast && (
        <div role="status" className="sc-toast">
          {games.toast}
        </div>
      )}
    </div>
  );
}
