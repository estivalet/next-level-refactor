import { defaultSettings } from '@nextlevel/shared';
import { useInputActions } from '@nextlevel/themes';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../settings/settingsApi.ts';
import { useUnlockKiosk } from './kioskApi.ts';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'] as const;
type PadKey = (typeof KEYS)[number];
const OK_INDEX = KEYS.indexOf('ok');
const MAX_DIGITS = 8;

/**
 * The kiosk PIN pad (US-D4, D54): digits from the keyboard, or the on-screen keys with the
 * directions and select of a gamepad or the arrow keys. Five wrong PINs make it wait a minute.
 */
export function PinPad({ onClose, onUnlocked }: { onClose: () => void; onUnlocked: () => void }) {
  const { t } = useTranslation();
  const loaded = useSettings().data;
  const input = loaded?.kind === 'ok' ? loaded.snapshot.settings.input : defaultSettings().input;
  const unlock = useUnlockKiosk();
  const [pin, setPin] = useState('');
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [waitMs, setWaitMs] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Takes the keyboard, and hands it back (to the theme, usually) when it closes.
  useEffect(() => {
    const before = document.activeElement;
    ref.current?.focus();
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, []);
  useEffect(() => {
    if (waitMs <= 0) return;
    const timer = setTimeout(() => {
      setWaitMs(0);
      setMessage(null);
    }, waitMs);
    return () => {
      clearTimeout(timer);
    };
  }, [waitMs]);

  const submit = () => {
    if (pin.length === 0 || waitMs > 0 || unlock.isPending) return;
    unlock.mutate(pin, {
      onSuccess: (result) => {
        setPin('');
        if (result.ok) {
          onUnlocked();
          return;
        }
        setWaitMs(result.retryAfterMs);
        setMessage(
          result.retryAfterMs > 0
            ? t('kiosk.pad.wait', { seconds: Math.ceil(result.retryAfterMs / 1000) })
            : t('kiosk.pad.wrong'),
        );
      },
    });
  };
  const press = (key: PadKey) => {
    if (key === 'ok') submit();
    else if (key === 'back') setPin((current) => current.slice(0, -1));
    else setPin((current) => (current.length < MAX_DIGITS ? current + key : current));
  };
  const move = (dx: number, dy: number) => {
    setIndex((current) => {
      const col = (current % 3) + dx;
      const row = Math.floor(current / 3) + dy;
      return ((row + 4) % 4) * 3 + ((col + 3) % 3);
    });
  };

  useInputActions({
    targetRef: ref,
    enabled: true,
    input,
    onAction: (action) => {
      if (action === 'up') move(0, -1);
      else if (action === 'down') move(0, 1);
      else if (action === 'left') move(-1, 0);
      else if (action === 'right') move(1, 0);
      else if (action === 'select') press(KEYS[index] ?? 'ok');
      else if (action === 'back') onClose();
    },
  });

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={t('kiosk.pad.title')}
      tabIndex={-1}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 outline-none backdrop-blur-sm"
      onKeyDownCapture={(event) => {
        // Esc still held from the 3-second hold must not close the pad straight away.
        if (event.key === 'Escape' && event.repeat) {
          event.preventDefault();
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation();
          return;
        }
        if (/^\d$/.test(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation();
          press(event.key as PadKey);
          setIndex(OK_INDEX);
        } else if (event.key === 'Backspace') {
          event.preventDefault();
          press('back');
        }
      }}
    >
      <div className="flex w-72 flex-col gap-4 rounded-2xl border border-white/10 bg-[#1a1c23] p-6 shadow-2xl">
        <h2 className="text-center text-base font-semibold text-white">{t('kiosk.pad.title')}</h2>
        <p
          aria-label={t('kiosk.pad.pin')}
          className="h-8 text-center font-mono text-2xl tracking-[0.4em] text-white"
        >
          {'•'.repeat(pin.length)}
        </p>
        {message && (
          <p role="alert" className="text-center text-sm text-[#ff8a80]">
            {message}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((key, i) => (
            <button
              key={key}
              type="button"
              tabIndex={-1}
              disabled={key === 'ok' && (waitMs > 0 || unlock.isPending)}
              aria-label={
                key === 'back' ? t('kiosk.pad.delete') : key === 'ok' ? t('kiosk.pad.ok') : key
              }
              onClick={() => {
                setIndex(i);
                press(key);
              }}
              className={`h-12 rounded-lg text-lg font-medium text-white disabled:opacity-40 ${
                i === index ? 'bg-[#990033] ring-2 ring-white' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {key === 'back' ? '⌫' : key === 'ok' ? t('kiosk.pad.ok') : key}
            </button>
          ))}
        </div>
        <button
          type="button"
          tabIndex={-1}
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
        >
          {t('kiosk.pad.cancel')}
        </button>
      </div>
    </div>
  );
}
