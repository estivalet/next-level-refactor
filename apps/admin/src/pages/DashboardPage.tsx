import { formatPrice } from '@nextlevel/shared';
import { Table } from '@nextlevel/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useStats } from '../api/hooks.ts';
import { errorKey, formatTime } from '../errors.ts';
import { hrefOf } from '../router.ts';
import { DownloadsChart } from './DownloadsChart.tsx';

function Tile({ title, children }: { title: string; children: ReactNode }) {
  const id = `tile-${title.replace(/\W+/g, '-')}`;
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="flex flex-col gap-1 rounded-xl border border-white/5 bg-[#111115] p-4"
    >
      <p id={id} className="text-xs text-slate-400">
        {title}
      </p>
      {children}
    </div>
  );
}

const big = 'text-2xl font-semibold text-white';
const link = 'text-sky-300 hover:underline';

/** S13 Dashboard, the console's landing page (FR-ADM-6, D38, D49). */
export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const stats = useStats();
  if (!stats.data) {
    return stats.error ? (
      <p role="alert" className="text-sm text-[#ff8a80]">
        {t(errorKey(stats.error))}
      </p>
    ) : null;
  }
  const s = stats.data;
  const quiet = s.downloadsPerDay.every((day) => day.count === 0);
  return (
    <section className="flex max-w-5xl flex-col gap-6">
      <h1 className="text-lg font-semibold text-white">{t('admin.dashboard.title')}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile title={t('admin.dashboard.subscribers')}>
          <p className={big}>{s.subscribers.paying + s.subscribers.comp}</p>
          <p className="text-xs text-slate-400">
            {t('admin.dashboard.subscribersSplit', {
              paying: s.subscribers.paying,
              comp: s.subscribers.comp,
            })}
          </p>
        </Tile>
        <Tile title={t('admin.dashboard.mrr')}>
          {s.mrr.length === 0 ? (
            <p className="text-sm text-slate-500">{t('admin.dashboard.noMrr')}</p>
          ) : (
            s.mrr.map((price) => (
              <p key={price.currency} className={big}>
                {formatPrice(price, i18n.language)}
              </p>
            ))
          )}
        </Tile>
        <Tile title={t('admin.dashboard.downloads7d')}>
          <p className={big}>{s.downloads7d}</p>
        </Tile>
      </div>
      <section aria-labelledby="downloads-title" className="flex flex-col gap-2">
        <h2 id="downloads-title" className="text-sm font-medium text-white">
          {t('admin.dashboard.chartTitle')}
        </h2>
        {quiet ? (
          <p className="text-sm text-slate-500">{t('admin.dashboard.noDownloads')}</p>
        ) : (
          <DownloadsChart days={s.downloadsPerDay} />
        )}
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Table
          label={t('admin.dashboard.topItems')}
          columns={[t('admin.dashboard.item'), t('admin.dashboard.downloads')]}
          empty={t('admin.dashboard.noTopItems')}
          rows={s.topItems.map((item) => ({
            key: item.itemId,
            cells: [
              <a
                key="title"
                href={hrefOf({ page: 'catalogItem', id: item.itemId, tab: 'metadata' })}
                className={link}
              >
                {item.title}
              </a>,
              item.downloads,
            ],
          }))}
        />
        <Table
          label={t('admin.dashboard.signups')}
          columns={[t('admin.users.email'), t('admin.dashboard.joined')]}
          empty={t('admin.dashboard.noSignups')}
          rows={s.recentSignups.map((user) => ({
            key: user.id,
            cells: [
              <a key="email" href={hrefOf({ page: 'user', id: user.id })} className={link}>
                {user.email}
              </a>,
              formatTime(user.createdAt, i18n.language, ''),
            ],
          }))}
        />
        <Table
          label={t('admin.dashboard.pastDue')}
          columns={[t('admin.users.email'), t('admin.dashboard.periodEnd')]}
          empty={t('admin.dashboard.noPastDue')}
          rows={s.pastDue.map((row) => ({
            key: row.userId,
            cells: [
              <a key="email" href={hrefOf({ page: 'user', id: row.userId })} className={link}>
                {row.email}
              </a>,
              formatTime(row.periodEnd, i18n.language, '—'),
            ],
          }))}
        />
      </div>
    </section>
  );
}
