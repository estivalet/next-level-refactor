// Ported from NextLevelOS src/themes/big-box/BigBoxTheme.tsx @ 3d530b7: input arrives as actions
// (keyboard or gamepad, US-C1), game lists have tabs (screen spec S5), and the games level lives
// in GamesView.
import './big-box.css';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Background } from '../components/Background.tsx';
import { cn } from '../components/cn.ts';
import { KeyHelpOverlay } from '../components/KeyHelpOverlay.tsx';
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
import { GamesView } from './GamesView.tsx';
import { BIG_BOX_KEYMAP } from './keymap.ts';
import { MenuView } from './MenuView.tsx';
import { accentFor } from './palette.ts';

export function BigBoxTheme({ onExit, inputEnabled = true, active = true }: ThemeComponentProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const nav = useThemeNavigation();
  const input = useHostInput(useThemeHost());
  useFilterLayout(true); // a system's filters are entries in the systems menu
  const [helpOpen, setHelpOpen] = useState(false);

  const level = nav.currentLevel;
  const status = nav.state.status;
  const stackDepth = nav.state.stack.length;
  const controller = useGamesLevelController({
    rootRef,
    columns: Number.MAX_SAFE_INTEGER,
    wrap: true,
  });
  const { tabbed } = controller;
  const listening = inputEnabled && !helpOpen;
  useThemeRootFocus(rootRef, { status, stackDepth, enabled: listening });

  useThemeInput({
    targetRef: rootRef,
    keymap: BIG_BOX_KEYMAP,
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

  const levelTitle = (l: Level) =>
    l.node ? nodeLabel(l.node, t) : l.kind === 'menu' ? l.title : '';
  const isGames = level?.kind === 'games';
  const focusIndex = isGames ? tabbed.displayFocus : nav.state.focusIndex;
  useNavigationSound({
    focusKey: focusIndex,
    levelKey: `${String(stackDepth)}:${levelIdentity(level)}:${tabbed.activeTabId}`,
    levelKind: level?.kind,
    muted: tabbed.search.isOpen || !active,
  });

  const focusKey = isGames
    ? controller.focusedGame
      ? String(controller.focusedGame.id)
      : ''
    : (nav.focusedNode?.name ?? '');
  const background = useFocusBackground({
    levelKind: level?.kind,
    focusKey,
    games: controller.games,
    systemName: level?.kind === 'games' ? level.node.name : '',
  });

  const { accent, accentSoft } = accentFor(nav.state.stack[1]?.node?.name ?? null);
  const rootStyle = {
    '--bigbox-accent': accent,
    '--bigbox-accent-soft': accentSoft,
  } as CSSProperties;

  if (status === 'loading' || status === 'error' || !level) {
    return (
      <div
        ref={rootRef}
        tabIndex={0}
        style={rootStyle}
        className="bigbox-root flex flex-col items-center justify-center gap-4 text-sm text-white/60"
      >
        {status === 'loading' ? (
          t('themes.common.loading')
        ) : (
          <>
            <span className="bigbox-display text-2xl text-white">
              {t('themes.common.menuFailed')}
            </span>
            {nav.state.error && <span className="text-xs text-white/40">{nav.state.error}</span>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={nav.retry}
                className="rounded-md bg-white/10 px-5 py-2 font-semibold text-white hover:bg-white/20"
              >
                {t('themes.common.retry')}
              </button>
              <button
                type="button"
                onClick={onExit}
                className="rounded-md border border-white/15 px-5 py-2 text-white/70 hover:text-white"
              >
                {t('themes.common.exit')}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const trail = nav.state.stack.slice(1, -1).map(levelTitle);
  return (
    <div ref={rootRef} tabIndex={0} className="bigbox-root" style={rootStyle}>
      <Background
        layers={background}
        paused={!active}
        overlay={
          <div
            className={cn(
              'pointer-events-none absolute inset-0',
              isGames
                ? 'bg-gradient-to-t from-black/90 via-black/30 to-transparent'
                : 'bg-gradient-to-r from-black/85 via-black/40 to-transparent',
            )}
          />
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
            <GamesView
              level={level}
              title={levelTitle(level)}
              trail={trail}
              controller={controller}
              input={input}
              onBack={nav.back}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <KeyHelpOverlay
        open={helpOpen}
        enabled={inputEnabled}
        onClose={() => {
          setHelpOpen(false);
          rootRef.current?.focus();
        }}
        keymap={BIG_BOX_KEYMAP}
        input={input}
        className="bg-black/60"
        panelClassName="bigbox-help"
        keyClassName="mr-1"
      />
    </div>
  );
}
