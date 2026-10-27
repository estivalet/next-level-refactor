import { AppErrorException, type AdminPlan } from '@nextlevel/shared';
import { Button, Dialog, Select, TextArea, TextField } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGrant } from '../api/hooks.ts';
import { errorKey } from '../errors.ts';

const REASONS = new Set(['subscribed', 'archived', 'past']);

function grantError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof AppErrorException) {
    const reason = (error.error.details as { reason?: unknown } | undefined)?.reason;
    if (typeof reason === 'string' && REASONS.has(reason)) {
      return `admin.subscription.reasons.${reason}`;
    }
  }
  return errorKey(error);
}

/**
 * Grant complimentary access (FR-SUB-4, D35): a plan that is not archived, an optional last day
 * (access ends at the end of that day, UTC) and a note for the audit log.
 */
export function GrantDialog({
  userId,
  plans,
  onClose,
}: {
  userId: string;
  plans: readonly AdminPlan[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const grant = useGrant(userId);
  const choices = plans.filter((plan) => !plan.archived);
  const [planSlug, setPlanSlug] = useState(choices[0]?.slug ?? '');
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  const trimmed = note.trim();
  const error = grantError(grant.error);
  return (
    <Dialog
      title={t('admin.subscription.grant')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('admin.subscription.cancel')}</Button>
          <Button
            variant="primary"
            disabled={grant.isPending || planSlug === '' || trimmed === '' || trimmed.length > 500}
            onClick={() => {
              grant.mutate(
                {
                  planSlug,
                  expiresAt: until ? `${until}T23:59:59.999Z` : null,
                  note: trimmed,
                },
                { onSuccess: onClose },
              );
            }}
          >
            {t('admin.subscription.grantButton')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Select
          label={t('admin.subscription.plan')}
          value={planSlug}
          onChange={(event) => {
            setPlanSlug(event.target.value);
          }}
          options={choices.map((plan) => ({ value: plan.slug, label: plan.name }))}
        />
        <TextField
          label={t('admin.subscription.expiresAt')}
          help={t('admin.subscription.expiresHelp')}
          type="date"
          value={until}
          onChange={(event) => {
            setUntil(event.target.value);
          }}
        />
        <TextArea
          label={t('admin.subscription.note')}
          help={t('admin.subscription.noteHelp')}
          maxLength={500}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
        {error && (
          <p role="alert" className="text-sm text-[#ff8a80]">
            {t(error)}
          </p>
        )}
      </div>
    </Dialog>
  );
}
