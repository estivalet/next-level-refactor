import type { SystemInfo, SystemPersonal } from '@nextlevel/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmulatorsSection } from './EmulatorsSection.tsx';
import { ModelImage } from './ModelImage.tsx';
import { NotesSection } from './NotesSection.tsx';

type TextField = {
  [K in keyof SystemInfo]-?: SystemInfo[K] extends string | number | undefined ? K : never;
}[keyof SystemInfo];

const OVERVIEW: readonly TextField[] = [
  'fullName',
  'manufacturer',
  'country',
  'releaseYear',
  'discontinuedYear',
  'generation',
  'unitsSold',
  'description',
];
const STORY: readonly TextField[] = ['history', 'legacy'];
const HARDWARE: readonly TextField[] = ['cpu', 'ram', 'graphics', 'sound', 'media', 'display'];
const MODEL_FIELDS = ['launchPrice', 'cpu', 'ram', 'notes'] as const;

const LABEL = 'text-slate-500';
const VALUE = 'whitespace-pre-line text-slate-200';
const GRID = 'grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm';

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="mb-6" aria-label={title}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {empty ? <p className="text-xs text-slate-500">{t('apps.museum.empty')}</p> : children}
    </section>
  );
}

function present(entry: SystemInfo, fields: readonly TextField[]) {
  return fields.filter((key) => entry[key] !== undefined);
}

/** Label/value rows for short facts. */
function FactSection({
  title,
  entry,
  fields,
}: {
  title: string;
  entry: SystemInfo;
  fields: readonly TextField[];
}) {
  const { t } = useTranslation();
  const shown = present(entry, fields);
  return (
    <Section title={title} empty={shown.length === 0}>
      <dl className={GRID}>
        {shown.map((key) => (
          <div key={key} className="contents">
            <dt className={LABEL}>{t(`apps.museum.field.${key}`)}</dt>
            <dd className={VALUE}>{entry[key]}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function StorySection({ title, entry }: { title: string; entry: SystemInfo }) {
  const { t } = useTranslation();
  const shown = present(entry, STORY);
  return (
    <Section title={title} empty={shown.length === 0}>
      {shown.map((key) => (
        <div key={key} className="mb-3">
          <h4 className={`mb-1 text-xs ${LABEL}`}>{t(`apps.museum.field.${key}`)}</h4>
          <p className={`text-sm ${VALUE}`}>{entry[key]}</p>
        </div>
      ))}
    </Section>
  );
}

function ModelsSection({ title, entry }: { title: string; entry: SystemInfo }) {
  const { t } = useTranslation();
  return (
    <Section title={title} empty={entry.models.length === 0}>
      <ul className="flex flex-col gap-3">
        {entry.models.map((model, index) => (
          <li key={`${model.name}-${String(index)}`} className="flex gap-3 text-sm text-slate-200">
            <ModelImage url={model.imageUrl} name={model.name} />
            <div className="min-w-0">
              <p className="font-medium">
                {model.name}
                {model.releaseYear !== undefined && (
                  <span className="ml-2 text-xs text-slate-500">{model.releaseYear}</span>
                )}
              </p>
              {MODEL_FIELDS.map(
                (key) =>
                  model[key] !== undefined && (
                    <p key={key} className="text-xs text-slate-400">
                      {t(`apps.museum.field.${key}`)}: {model[key]}
                    </p>
                  ),
              )}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function RelatedSection({ title, entry }: { title: string; entry: SystemInfo }) {
  const { t } = useTranslation();
  const rows = [
    ['predecessor', entry.predecessor],
    ['successor', entry.successor],
    ['peripherals', entry.peripherals.length > 0 ? entry.peripherals.join(', ') : undefined],
  ] as const;
  const shown = rows.filter(([, value]) => value !== undefined);
  return (
    <Section title={title} empty={shown.length === 0}>
      <dl className={GRID}>
        {shown.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className={LABEL}>{t(`apps.museum.field.${key}`)}</dt>
            <dd className={VALUE}>{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function TopGamesSection({ title, entry }: { title: string; entry: SystemInfo }) {
  return (
    <Section title={title} empty={entry.topGames.length === 0}>
      <ol className="list-decimal pl-5 text-sm text-slate-200">
        {entry.topGames.map((game, index) => (
          <li key={`${game.title}-${String(index)}`}>
            {game.title}
            {game.year !== undefined && (
              <span className="ml-2 text-xs text-slate-500">{game.year}</span>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

/**
 * Source names; one is a link only when its URL is https (main drops other external links, so
 * anything else would be a dead link). Main opens the link in the browser.
 */
function SourcesSection({ title, entry }: { title: string; entry: SystemInfo }) {
  return (
    <Section title={title} empty={entry.sources.length === 0}>
      <p className="text-sm text-slate-200">
        {entry.sources.map((source, index) => (
          <span key={`${source.name}-${String(index)}`}>
            {index > 0 && ', '}
            {source.url?.startsWith('https://') ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline"
              >
                {source.name}
              </a>
            ) : (
              <span>{source.name}</span>
            )}
          </span>
        ))}
      </p>
    </Section>
  );
}

/**
 * Every read-only section of a system's page, in page order: the owner's notes and emulators first
 * (FR-MUS-6, FR-MUS-7), then the museum entry (FR-MUS-2, FR-MUS-5).
 */
export function EntrySections({
  entry,
  personal,
}: {
  entry: SystemInfo;
  personal: SystemPersonal;
}) {
  const { t } = useTranslation();
  const title = (key: string) => t(`apps.museum.sections.${key}`);
  return (
    <>
      <NotesSection title={title('notes')} notes={personal.notes} />
      <EmulatorsSection title={title('emulators')} systemId={entry.systemId} />
      <FactSection title={title('overview')} entry={entry} fields={OVERVIEW} />
      <StorySection title={title('story')} entry={entry} />
      <FactSection title={title('hardware')} entry={entry} fields={HARDWARE} />
      <ModelsSection title={title('models')} entry={entry} />
      {/* The gallery goes here (FR-MUS-8). */}
      <RelatedSection title={title('related')} entry={entry} />
      <TopGamesSection title={title('topGames')} entry={entry} />
      <SourcesSection title={title('sources')} entry={entry} />
    </>
  );
}
