import type { Device } from '@nextlevel/shared';
import { Button, Dialog, Select, Table } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePatchUser, useRevokeUserDevice, useUser } from '../api/hooks.ts';
import { errorKey, formatTime } from '../errors.ts';
import { hrefOf } from '../router.ts';
import { AuditTable } from './AuditTable.tsx';
import { DeleteUserDialog } from './DeleteUserDialog.tsx';
import { SubscriptionPanel } from './SubscriptionPanel.tsx';
import { SuspendDialog } from './SuspendDialog.tsx';

/**
 * S13 user detail (FR-ADM-1, FR-AUTH-7, US-F3, FR-SUB-4): role, suspension, subscription and
 * grants, devices, audit trail.
 */
export function UserDetailPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const user = useUser(id);
  const patch = usePatchUser(id);
  const revoke = useRevokeUserDevice(id);
  const [suspending, setSuspending] = useState(false);
  const [revoking, setRevoking] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);
  const detail = user.data;
  if (user.isError) {
    return (
      <p role="alert" className="text-sm text-[#ff8a80]">
        {t(errorKey(user.error))}
      </p>
    );
  }
  if (!detail) return null;
  const failure = patch.error ?? revoke.error;
  const when = (iso: string | null) => formatTime(iso, i18n.language, t('admin.users.never'));

  return (
    <section className="flex flex-col gap-5">
      <a href={hrefOf({ page: 'users' })} className="text-xs text-sky-300 hover:underline">
        {t('admin.user.back')}
      </a>
      <header className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-white">{detail.email}</h1>
          <p className="text-sm text-slate-400">
            {detail.name} · {t(`admin.status.${detail.status}`)}
          </p>
          {detail.suspendedReason && (
            <p className="text-sm text-amber-200">
              {t('admin.user.suspendedBecause', { reason: detail.suspendedReason })}
            </p>
          )}
        </div>
        <Select
          label={t('admin.user.role')}
          value={detail.role}
          disabled={patch.isPending}
          onChange={(event) => {
            patch.mutate({ role: event.target.value === 'admin' ? 'admin' : 'subscriber' });
          }}
          options={[
            { value: 'subscriber', label: t('admin.roles.subscriber') },
            { value: 'admin', label: t('admin.roles.admin') },
          ]}
        />
        {detail.status === 'active' ? (
          <Button
            variant="danger"
            onClick={() => {
              setSuspending(true);
            }}
          >
            {t('admin.user.suspend')}
          </Button>
        ) : (
          <Button
            disabled={patch.isPending}
            onClick={() => {
              patch.mutate({ status: 'active' });
            }}
          >
            {t('admin.user.unsuspend')}
          </Button>
        )}
      </header>
      {/* A deleted account kept as a tombstone can't be deleted again. */}
      {detail.role !== 'admin' && !detail.email.endsWith('@deleted.invalid') && (
        <div>
          <Button
            variant="danger"
            onClick={() => {
              setDeleting(true);
            }}
          >
            {t('admin.deleteUser.open')}
          </Button>
        </div>
      )}
      {failure && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(errorKey(failure))}
        </p>
      )}
      <SubscriptionPanel userId={detail.id} subscriptions={detail.subscriptions} />
      <h2 className="text-sm font-semibold text-white">{t('admin.user.devices')}</h2>
      <Table
        label={t('admin.user.devices')}
        columns={[t('admin.users.devices'), t('admin.users.lastSeen'), '']}
        empty={t('admin.user.noDevices')}
        rows={detail.devices.map((device) => ({
          key: device.id,
          cells: [
            device.name,
            when(device.lastSeenAt),
            device.revokedAt ? (
              t('admin.user.revoked')
            ) : (
              <Button
                key="revoke"
                onClick={() => {
                  setRevoking(device);
                }}
              >
                {t('admin.user.revoke')}
              </Button>
            ),
          ],
        }))}
      />
      <h2 className="text-sm font-semibold text-white">{t('admin.user.audit')}</h2>
      <AuditTable entries={detail.audit} label={t('admin.user.audit')} />
      {deleting && (
        <DeleteUserDialog
          userId={detail.id}
          email={detail.email}
          onClose={() => {
            setDeleting(false);
          }}
        />
      )}
      {suspending && (
        <SuspendDialog
          email={detail.email}
          busy={patch.isPending}
          onClose={() => {
            setSuspending(false);
          }}
          onSuspend={(reason) => {
            patch.mutate(
              { status: 'suspended', suspendedReason: reason },
              {
                onSettled: () => {
                  setSuspending(false);
                },
              },
            );
          }}
        />
      )}
      {revoking && (
        <Dialog
          title={t('admin.user.revokeTitle', { name: revoking.name })}
          onClose={() => {
            setRevoking(null);
          }}
          footer={
            <>
              <Button
                onClick={() => {
                  setRevoking(null);
                }}
              >
                {t('admin.user.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  revoke.mutate(revoking.id);
                  setRevoking(null);
                }}
              >
                {t('admin.user.revoke')}
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-300">{t('admin.user.revokeBody')}</p>
        </Dialog>
      )}
    </section>
  );
}
