import { Button, TextField } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudit } from '../api/hooks.ts';
import { AuditTable } from './AuditTable.tsx';

/** S13 Audit log (FR-ADM-5): newest first, filter by admin or target id. */
export function AuditPage() {
  const { t } = useTranslation();
  const [actor, setActor] = useState('');
  const [target, setTarget] = useState('');
  const audit = useAudit({ actor: actor.trim(), target: target.trim() });
  const entries = audit.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-white">{t('admin.audit.title')}</h1>
      <div className="flex gap-3">
        <TextField
          label={t('admin.audit.actor')}
          value={actor}
          onChange={(event) => {
            setActor(event.target.value);
          }}
        />
        <TextField
          label={t('admin.audit.target')}
          value={target}
          onChange={(event) => {
            setTarget(event.target.value);
          }}
        />
      </div>
      <AuditTable entries={entries} label={t('admin.audit.title')} />
      {audit.hasNextPage && (
        <div>
          <Button
            onClick={() => {
              void audit.fetchNextPage();
            }}
          >
            {t('admin.users.loadMore')}
          </Button>
        </div>
      )}
    </section>
  );
}
