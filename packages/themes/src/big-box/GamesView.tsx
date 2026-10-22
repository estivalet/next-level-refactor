// The games level of Big Box, split out of NextLevelOS src/themes/big-box/BigBoxTheme.tsx @ 3d530b7:
// detail card, tabs (screen spec S5), box-art carousel, search, hints and failure toasts.
import type { InputSettings } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { CascadingImage } from '../components/CascadingImage.tsx';
import { Carousel } from '../components/Carousel.tsx';
import { cn } from '../components/cn.ts';
import { GameDetailPanel } from '../components/GameDetailPanel.tsx';
import { tabLabel } from '../components/gameTabs.ts';
import { HintBar } from '../components/HintBar.tsx';
import { TabBar } from '../components/TabBar.tsx';
import type { useGamesLevelController } from '../components/useGamesLevelController.ts';
import { describeKeymap } from '../engine/intentLabels.ts';
import type { Level } from '../engine/types.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';
import { BIG_BOX_KEYMAP } from './keymap.ts';
import { LevelChrome } from './LevelChrome.tsx';

type GamesLevel = Extract<Level, { kind: 'games' }>;
type Controller = ReturnType<typeof useGamesLevelController>;

const HINT_INTENTS = ['focus-next', 'enter', 'back', 'toggle-search', 'show-help'] as const;

export function GamesView({
  level,
  title,
  trail,
  controller,
  input,
  onBack,
}: {
  level: GamesLevel;
  title: string;
  trail: string[];
  controller: Controller;
  input: InputSettings;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const art = useThemeArt();
  const { tabbed, focusedGame } = controller;
  const items = tabbed.display;
  const hints = describeKeymap(BIG_BOX_KEYMAP, input, HINT_INTENTS).map((row) => ({
    keys: [row.keys[0], row.buttons[0]].filter((key): key is string => !!key),
    label: t(row.labelKey),
  }));

  const message = level.loading
    ? t('themes.common.loading')
    : level.error
      ? t('themes.common.levelFailed', { name: title })
      : items.length === 0
        ? t('themes.common.noGames')
        : null;

  return (
    <>
      <div
        className={cn(
          'bigbox-card absolute top-8 left-8 max-w-[36rem] p-6',
          !focusedGame && 'invisible',
        )}
      >
        <GameDetailPanel
          game={focusedGame}
          onLaunch={(game) => void controller.play(game)}
          slots={{
            renderTitle: (game) => (
              <h1 className="bigbox-display text-4xl leading-none font-black">{game.title}</h1>
            ),
          }}
        />
      </div>

      <LevelChrome title={title} count={items.length} trail={trail} onBack={onBack} />

      <TabBar
        tabs={tabbed.tabs.map((tab) => ({
          id: tab.id,
          label: tabLabel(tab, t),
          count: tabbed.counts[tab.id] ?? 0,
        }))}
        activeId={tabbed.activeTabId}
        onChange={tabbed.selectTab}
        className="bigbox-tabs absolute top-20 right-8"
        tabClassName="bigbox-tab"
        activeTabClassName="bigbox-tab--active"
      />

      <div className="absolute inset-x-0 bottom-0 h-[42%] pb-12">
        {message ? (
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            {message}
          </div>
        ) : (
          <Carousel
            items={items}
            focusIndex={Math.max(0, tabbed.displayFocus)}
            onFocusChange={tabbed.setDisplayFocus}
            onActivate={(index) => {
              const game = items[index];
              if (game) void controller.play(game);
            }}
            itemWidth={224}
            gap={0}
            visibleRadius={7}
            className="h-full"
            renderItem={({ item, focused }) => {
              const state = focused ? 'bigbox-carousel-item--focused' : 'bigbox-carousel-item--dim';
              return (
                <div className="flex h-full items-center justify-center">
                  <CascadingImage
                    srcs={art.gameTile(item)}
                    alt={item.title}
                    className={cn(
                      'bigbox-carousel-art max-h-[80%] w-auto max-w-full object-contain',
                      state,
                    )}
                    fallback={
                      <div
                        className={cn(
                          'bigbox-carousel-plate flex h-[80%] w-full items-center justify-center p-3 text-center text-xs text-white/60',
                          state,
                        )}
                      >
                        {item.title}
                      </div>
                    }
                  />
                </div>
              );
            }}
          />
        )}
      </div>

      {tabbed.search.isOpen && (
        <input
          type="search"
          autoFocus
          aria-label={t('themes.common.searchLabel')}
          placeholder={t('themes.common.searchPlaceholder')}
          className="bigbox-search absolute bottom-[44%] left-1/2 w-80 -translate-x-1/2"
          {...controller.searchInputProps}
        />
      )}

      {controller.toast && (
        <div role="status" className="bigbox-toast absolute bottom-16 left-1/2 -translate-x-1/2">
          {controller.toast}
        </div>
      )}

      <HintBar
        hints={hints}
        className="bigbox-hint-row absolute right-8 bottom-3"
        keyClassName="bigbox-hint-key"
      />
    </>
  );
}
