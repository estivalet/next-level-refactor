import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function TrayClock({ now = () => new Date() }: { now?: () => Date }) {
  const { t, i18n } = useTranslation();
  const [time, setTime] = useState(now);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [now]);

  const label = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(time);

  return (
    <time
      aria-label={t('shell.tray.clock')}
      dateTime={time.toISOString()}
      className="text-xs text-slate-300 tabular-nums"
    >
      {label}
    </time>
  );
}
