import type { Device } from '@nextlevel/shared';
import { Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SECONDARY } from './GateFrame.tsx';

/** An account's devices with one action each (Account → Revoke, device limit → Remove). */
export function DeviceList({
  devices,
  label,
  actionLabel,
  onAction,
  busy,
  focusFirst = false,
}: {
  devices: readonly Device[];
  label: string;
  actionLabel: string;
  onAction: (device: Device) => void;
  busy: boolean;
  /** Put the keyboard on the first action (a gate screen that is only this choice). */
  focusFirst?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const when = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso));
  return (
    <ul aria-label={label} className="flex flex-col divide-y divide-white/5">
      {devices.map((device, index) => (
        <li key={device.id} className="flex items-center gap-3 py-2">
          <Monitor aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-slate-200">{device.name}</p>
            <p className="text-xs text-slate-500">
              {device.current
                ? t('account.thisDevice')
                : t('account.lastSeen', { time: when(device.lastSeenAt) })}
            </p>
          </div>
          {!device.current && (
            <button
              type="button"
              autoFocus={focusFirst && index === devices.findIndex((d) => !d.current)}
              disabled={busy}
              className={SECONDARY}
              onClick={() => {
                onAction(device);
              }}
            >
              {actionLabel}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
