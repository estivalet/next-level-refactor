// The sections of the museum page (FR-MUS-4, FR-MUS-5), split out of MuseumPage.tsx.
import { remoteImageUrl, type ThemeSystemInfo } from '@nextlevel/shared';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Entry = ThemeSystemInfo;

const HARDWARE_FIELDS = [
  'generation',
  'cpu',
  'ram',
  'graphics',
  'sound',
  'media',
  'display',
  'unitsSold',
  'discontinuedYear',
  'predecessor',
  'successor',
] as const;

/** True when the entry carries nothing beyond its system id. */
export function isEmptyEntry(info: Entry): boolean {
  return Object.entries(info).every(([key, value]) =>
    key === 'systemId' ? true : Array.isArray(value) ? value.length === 0 : value === undefined,
  );
}

/** `manufacturer · releaseYear · country`, missing parts skipped. */
export function headline(info: Entry): string {
  return [info.manufacturer, info.releaseYear, info.country]
    .filter((part) => part !== undefined && part !== '')
    .join(' · ');
}

export function Hardware({ info }: { info: Entry }) {
  const { t } = useTranslation();
  const rows: [string, string][] = HARDWARE_FIELDS.flatMap((key) => {
    const value = info[key];
    return value === undefined ? [] : [[t(`themes.museum.field.${key}`), String(value)]];
  });
  if (info.peripherals.length > 0) {
    rows.push([t('themes.museum.field.peripherals'), info.peripherals.join(', ')]);
  }
  if (rows.length === 0) return null;
  return (
    <section className="museum-section">
      <h3>{t('themes.museum.hardware')}</h3>
      <dl className="museum-hardware">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ModelImage({ name, url }: { name: string; url: string | undefined }) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  // Main fetches and caches the image (FR-MUS-4); the strict CSP only allows nextlevel: images.
  const src = url === undefined ? null : remoteImageUrl(url);
  return (
    <div className="museum-model-image">
      {src !== null && !broken ? (
        <img
          src={src}
          alt={name}
          onError={() => {
            setBroken(true);
          }}
        />
      ) : (
        <span className="museum-model-placeholder">{t('themes.museum.modelImageMissing')}</span>
      )}
    </div>
  );
}

export function Models({ info }: { info: Entry }) {
  const { t } = useTranslation();
  if (info.models.length === 0) return null;
  return (
    <section className="museum-section">
      <h3>{t('themes.museum.models')}</h3>
      <ul className="museum-models">
        {info.models.map((model, index) => (
          <li key={`${model.name}-${String(index)}`} className="museum-model">
            <ModelImage name={model.name} url={model.imageUrl} />
            <strong>{model.name}</strong>
            {model.releaseYear !== undefined && <span>{model.releaseYear}</span>}
            {model.launchPrice && (
              <span>{t('themes.museum.launchPrice', { price: model.launchPrice })}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TopGames({ info, onLaunch }: { info: Entry; onLaunch: (gameId: number) => void }) {
  const { t } = useTranslation();
  if (info.topGames.length === 0) return null;
  return (
    <section className="museum-section">
      <h3>{t('themes.museum.topGames')}</h3>
      <ul className="museum-games">
        {info.topGames.map((game, index) => {
          const label =
            game.year === undefined ? game.title : `${game.title} (${String(game.year)})`;
          return (
            <li key={`${game.title}-${String(index)}`}>
              {game.owned ? (
                <button
                  type="button"
                  className="museum-game museum-game-owned"
                  data-museum-focus=""
                  title={t('themes.museum.topGameOwned')}
                  onClick={() => {
                    if (game.owned) onLaunch(game.owned.gameId);
                  }}
                >
                  {label}
                </button>
              ) : (
                <span className="museum-game">{label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Source names only: a link would open a browser and leave kiosk mode (FR-SET-6). */
export function Sources({ info }: { info: Entry }) {
  const { t } = useTranslation();
  if (info.sources.length === 0) return null;
  return (
    <p className="museum-sources">
      <span>{t('themes.museum.sources')}: </span>
      {info.sources.map((source, index) => (
        <Fragment key={`${source.name}-${String(index)}`}>
          {index > 0 && ', '}
          <span>{source.name}</span>
        </Fragment>
      ))}
    </p>
  );
}
