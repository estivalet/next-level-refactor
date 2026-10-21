import { Archive, FolderOpen, Info, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { AboutSection } from './AboutSection.tsx';
import { BackupsSection } from './BackupsSection.tsx';
import { DataSection } from './DataSection.tsx';
import { GeneralSection } from './GeneralSection.tsx';

interface Section {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  Component: ComponentType;
}

// IA §1 Settings sections; the rest arrive with the milestones that add their options.
const SECTIONS: readonly Section[] = [
  {
    id: 'general',
    labelKey: 'settings.sections.general',
    icon: SlidersHorizontal,
    Component: GeneralSection,
  },
  {
    id: 'backups',
    labelKey: 'settings.sections.backups',
    icon: Archive,
    Component: BackupsSection,
  },
  { id: 'data', labelKey: 'settings.sections.data', icon: FolderOpen, Component: DataSection },
  { id: 'about', labelKey: 'settings.sections.about', icon: Info, Component: AboutSection },
];

export function SettingsApp() {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState('general');
  const selected = SECTIONS.find((section) => section.id === selectedId) ?? SECTIONS[0];

  return (
    <div className="flex h-full">
      <nav
        aria-label={t('settings.sections.label')}
        className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-white/5 bg-black/20 p-2"
      >
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-current={section.id === selected?.id ? 'page' : undefined}
            onClick={() => {
              setSelectedId(section.id);
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none aria-[current=page]:bg-white/15 aria-[current=page]:text-white"
          >
            <section.icon aria-hidden="true" className="h-4 w-4" />
            {t(section.labelKey)}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-auto">{selected && <selected.Component />}</div>
    </div>
  );
}
