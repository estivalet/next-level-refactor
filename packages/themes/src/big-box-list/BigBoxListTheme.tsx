// Ported from NextLevelOS src/themes/big-box-list/BigBoxListTheme.tsx @ 3d530b7: input arrives as
// actions (US-C1), the games level drives through useGamesLevelController (S5 tabs, favorite,
// hide, page jumps), and strings go through i18n.
import '../big-box/big-box.css';
import './big-box-list.css';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { BIG_BOX_BUTTON } from '../big-box/BigBoxTheme.tsx';
import { MenuView } from '../big-box/MenuView.tsx';
import { accentFor } from '../big-box/palette.ts';
import { Background } from '../components/Background.tsx';
import { KeyHelpOverlay } from '../components/KeyHelpOverlay.tsx';
import { MENU_STATUS_ROOT, MenuStatusContent } from '../components/MenuStatusContent.tsx';
import { useFocusBackground } from '../components/useFocusBackground.ts';
import { useGamesLevelController } from '../components/useGamesLevelController.ts';
import { levelIdentity, useNavigationSound } from '../components/useNavigationSound.ts';
import { useThemeRootFocus } from '../components/useThemeRootFocus.ts';
import { nodeLabel } from '../engine/levelModel.ts';
import { levelPush } from '../engine/transitions.ts';
import type { Level, ThemeComponentProps } from '../engine/types.ts';
import { useFilterLayout } from '../engine/useFilterLayout.ts';
import { useHostInput, useThemeInput } from '../engine/useThemeInput.ts';
import { useThemeHost, useThemeNavigation } from '../engine/useThemeNavigation.ts';
import { GamesLevel } from './GamesLevel.tsx';
import { BBL_GAMES_KEYMAP, BBL_MENU_KEYMAP } from './keymap.ts';

/** Rows one page jump moves (D5): about one screen of the list. */
const PAGE_SIZE = 10;

export function BigBoxListTheme({
  onExit,
  inputEnabled = true,
  active = true,
}: ThemeComponentProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const nav = useThemeNavigation();
  const input = useHostInput(useThemeHost());
  useFilterLayout(true); // a system's filters are entries in the systems menu
  const [helpOpen, setHelpOpen] = useState(false);

  const level = nav.currentLevel;
  const status = nav.state.status;
  const stackDepth = nav.state.stack.length;
  const isGames = level?.kind === 'games';
  const controller = useGamesLevelController({
    rootRef,
    columns: Number.MAX_SAFE_INTEGER,
    wrap: true,
    pageSize: PAGE_SIZE,
  });
  const { tabbed, focusedGame } = controller;
  const listening = inputEnabled && !helpOpen;
  useThemeRootFocus(rootRef, { status, stackDepth, enabled: listening });

  const searchOpen = tabbed.search.isOpen;
  const toggleSearch = () => {
    // Closing from the icon hands the keyboard back to the root.
    if (searchOpen) rootRef.current?.focus();
    controller.onToggleSearch();
  };

  useThemeInput({
    targetRef: rootRef,
    keymap: isGames ? BBL_GAMES_KEYMAP : BBL_MENU_KEYMAP,
    enabled: listening && !controller.searchFocused,
    onToggleSearch: controller.onToggleSearch,
    onIntent: (intent) => {
      if (intent === 'show-help') {
        setHelpOpen(true);
        return true;
      }
      if (intent === 'open-menu') {
        onExit();
        return true;
      }
      return controller.handleIntent(intent);
    },
  });

  useNavigationSound({
    focusKey: isGames ? tabbed.displayFocus : nav.state.focusIndex,
    levelKey: `${String(stackDepth)}:${levelIdentity(level)}:${tabbed.activeTabId}`,
    levelKind: level?.kind,
    muted: searchOpen || !active,
  });

  const background = useFocusBackground({
    levelKind: level?.kind,
    focusKey: isGames ? String(focusedGame?.id ?? '') : (nav.focusedNode?.name ?? ''),
    games: controller.games,
    systemName: level?.kind === 'games' ? level.node.name : '',
  });

  const { accent, accentSoft } = accentFor(nav.state.stack[1]?.node?.name ?? null);
  const rootStyle = {
    '--bigbox-accent': accent,
    '--bigbox-accent-soft': accentSoft,
  } as CSSProperties;

  if (status !== 'ready' || !level) {
    return (
      <div
        ref={rootRef}
        tabIndex={0}
        style={rootStyle}
        className={`bigbox-root bbl-root ${MENU_STATUS_ROOT}`}
      >
        <MenuStatusContent
          status={status}
          error={nav.state.error}
          onRetry={nav.retry}
          onExit={onExit}
          titleClassName="bigbox-display"
          buttonClassName={BIG_BOX_BUTTON}
        />
      </div>
    );
  }

  const label = (l: Level) => (l.node ? nodeLabel(l.node, t) : l.kind === 'menu' ? l.title : '');
  const trail = nav.state.stack.slice(1, -1).map(label);

  return (
    <div ref={rootRef} tabIndex={0} className="bigbox-root bbl-root" style={rootStyle}>
      <Background
        layers={background}
        paused={!active}
        overlay={
          isGames ? undefined : (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
          )
        }
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={stackDepth}
          initial={{ opacity: 0, y: 14, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.99 }}
          transition={levelPush}
          className="absolute inset-0"
        >
          {level.kind === 'menu' ? (
            <MenuView
              level={level}
              focusIndex={nav.state.focusIndex}
              trail={trail}
              onFocusChange={nav.setFocus}
              onEnter={nav.enter}
              onBack={nav.back}
            />
          ) : (
            <GamesLevel
              level={level}
              stack={nav.state.stack}
              controller={controller}
              input={input}
              onToggleSearch={toggleSearch}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {controller.toast && (
        <div role="status" className="bigbox-toast absolute bottom-16 left-1/2 -translate-x-1/2">
          {controller.toast}
        </div>
      )}

      <KeyHelpOverlay
        open={helpOpen}
        enabled={inputEnabled}
        onClose={() => {
          setHelpOpen(false);
          rootRef.current?.focus();
        }}
        keymap={isGames ? BBL_GAMES_KEYMAP : BBL_MENU_KEYMAP}
        input={input}
        className="bg-black/60"
        panelClassName="bigbox-help"
        keyClassName="mr-1"
      />
    </div>
  );
}
