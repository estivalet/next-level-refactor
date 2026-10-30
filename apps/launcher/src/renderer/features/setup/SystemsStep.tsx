import type { Settings } from '@nextlevel/shared';
import { POPULAR_SYSTEM_IDS, systemCatalog } from '@nextlevel/system-catalog';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NEXT_BUTTON, type StepProps } from './stepProps.ts';

/**
 * Step 1 (FR-ONB-1): which systems to show. A new install starts with the popular ones ticked;
 * search adds any other. Next saves the choice.
 */
export function SystemsStep({ settings, persist, next }: StepProps) {
  const { t } = useTranslation();
  const enabled = Object.entries(settings.systems)
    .filter(([, system]) => system.enabled)
    .map(([id]) => id);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(enabled.length > 0 ? enabled : POPULAR_SYSTEM_IDS),
  );
  const [shown, setShown] = useState<string[]>(() => [
    ...new Set([...POPULAR_SYSTEM_IDS, ...enabled]),
  ]);
  const [query, setQuery] = useState('');
  const all = useMemo(() => [...systemCatalog()].sort((a, b) => a.name.localeCompare(b.name)), []);
  const nameOf = (id: string) => all.find((s) => s.id === id)?.name ?? id;
  const matches = query.trim()
    ? all
        .filter((s) => !shown.includes(s.id))
        .filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 20)
    : [];

  const toggle = (id: string, on: boolean) => {
    setChecked((current) => {
      const copy = new Set(current);
      if (on) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  const save = async () => {
    const systems: Settings['systems'] = { ...settings.systems };
    for (const id of shown) {
      const on = checked.has(id);
      if (on || systems[id]) systems[id] = { ...systems[id], enabled: on };
    }
    await persist({ ...settings, systems });
    next();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-300">{t('setup.systems.intro')}</p>
      <ul aria-label={t('setup.systems.list')} className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        {shown.map((id) => (
          <li key={id}>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={checked.has(id)}
                onChange={(event) => {
                  toggle(id, event.target.checked);
                }}
              />
              {nameOf(id)}
            </label>
          </li>
        ))}
      </ul>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        {t('setup.systems.more')}
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          className="w-64 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
        />
      </label>
      {matches.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {matches.map((system) => (
            <li key={system.id}>
              <button
                type="button"
                onClick={() => {
                  setShown((list) => [...list, system.id]);
                  toggle(system.id, true);
                  setQuery('');
                }}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
              >
                + {system.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <button type="button" className={NEXT_BUTTON} onClick={() => void save()}>
          {t('setup.next')}
        </button>
      </div>
    </div>
  );
}
