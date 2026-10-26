import { Button, Select, Table, TextField } from '@nextlevel/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsers } from '../api/hooks.ts';
import { errorKey, formatTime } from '../errors.ts';
import { hrefOf } from '../router.ts';

/** S13 Users (FR-ADM-1): search, status filter, newest first, Load more. */
export function UsersPage() {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  // The search runs when typing pauses for 300 ms.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(text.trim());
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [text]);
  const users = useUsers({ q, status });
  const rows = users.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-white">{t('admin.users.title')}</h1>
      <div className="flex items-end gap-3">
        <div className="w-72">
          <TextField
            label={t('admin.users.search')}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        </div>
        <Select
          label={t('admin.users.statusFilter')}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
          }}
          options={[
            { value: '', label: t('admin.users.allStatuses') },
            { value: 'active', label: t('admin.status.active') },
            { value: 'suspended', label: t('admin.status.suspended') },
          ]}
        />
      </div>
      {users.isError && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(errorKey(users.error))}
        </p>
      )}
      <Table
        label={t('admin.users.title')}
        columns={[
          t('admin.users.email'),
          t('admin.users.role'),
          t('admin.users.plan'),
          t('admin.users.statusColumn'),
          t('admin.users.devices'),
          t('admin.users.lastSeen'),
        ]}
        empty={users.isSuccess ? t('admin.users.empty') : ''}
        rows={rows.map((row) => ({
          key: row.id,
          cells: [
            <a
              key="email"
              href={hrefOf({ page: 'user', id: row.id })}
              className="text-sky-300 hover:underline"
            >
              {row.email}
            </a>,
            t(`admin.roles.${row.role}`),
            row.role === 'admin' ? t('admin.users.noPlan') : t('admin.users.defaultPlan'),
            t(`admin.status.${row.status}`),
            row.devices,
            formatTime(row.lastSeenAt, i18n.language, t('admin.users.never')),
          ],
        }))}
      />
      {users.hasNextPage && (
        <div>
          <Button
            disabled={users.isFetchingNextPage}
            onClick={() => {
              void users.fetchNextPage();
            }}
          >
            {t('admin.users.loadMore')}
          </Button>
        </div>
      )}
    </section>
  );
}
