import type { AuditEntry } from '@nextlevel/shared';
import { Table } from '@nextlevel/ui';
import { useTranslation } from 'react-i18next';
import { formatTime } from '../errors.ts';
import { AuditDiff } from './AuditDiff.tsx';

/** Audit entries as a table: time, admin, action, target, what changed (FR-ADM-5). */
export function AuditTable({ entries, label }: { entries: readonly AuditEntry[]; label: string }) {
  const { t, i18n } = useTranslation();
  return (
    <Table
      label={label}
      columns={[
        t('admin.audit.time'),
        t('admin.audit.admin'),
        t('admin.audit.action'),
        t('admin.audit.targetColumn'),
        t('admin.audit.changes'),
      ]}
      empty={t('admin.audit.empty')}
      rows={entries.map((entry) => ({
        key: entry.id,
        cells: [
          formatTime(entry.at, i18n.language, ''),
          entry.actor.email,
          t(`admin.audit.actions.${entry.action}`, { defaultValue: entry.action }),
          <span
            key="target"
            className="font-mono text-xs"
          >{`${entry.targetType} ${entry.targetId}`}</span>,
          <AuditDiff key="diff" before={entry.before} after={entry.after} />,
        ],
      }))}
    />
  );
}
