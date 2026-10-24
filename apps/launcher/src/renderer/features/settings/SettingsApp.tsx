import {
  Archive,
  FolderOpen,
  Gamepad2,
  HardDrive,
  ImageDown,
  Info,
  Joystick,
  Keyboard,
  Palette,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { AboutSection } from './AboutSection.tsx';
import { BackupsSection } from './BackupsSection.tsx';
import { DataSection } from './DataSection.tsx';
import { EmulatorsSection } from './emulators/EmulatorsSection.tsx';
import type { FocusRequest } from './focusRequest.ts';
import { GeneralSection } from './GeneralSection.tsx';
import { InputSection } from './input/InputSection.tsx';
import type { AppParams } from '../shell/windowManager.ts';
import { ScraperSection } from './scraper/ScraperSection.tsx';
import { StorageSection } from './StorageSection.tsx';
import { SystemsSection } from './systems/SystemsSection.tsx';
import { ThemesSection } from './ThemesSection.tsx';

interface Section {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  /** `focus` opens that item, e.g. the system or profile an error points at. */
  Component: ComponentType<{ focus?: FocusRequest }>;
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
    id: 'storage',
    labelKey: 'settings.sections.storage',
    icon: HardDrive,
    Component: StorageSection,
  },
  {
    id: 'systems',
    labelKey: 'settings.sections.systems',
    icon: Gamepad2,
    Component: SystemsSection,
  },
  {
    id: 'emulators',
    labelKey: 'settings.sections.emulators',
    icon: Joystick,
    Component: EmulatorsSection,
  },
  {
    id: 'themes',
    labelKey: 'settings.sections.themes',
    icon: Palette,
    Component: ThemesSection,
  },
  {
    id: 'input',
    labelKey: 'settings.sections.input',
    icon: Keyboard,
    Component: InputSection,
  },
  {
    id: 'scraper',
    labelKey: 'settings.sections.scraper',
    icon: ImageDown,
    Component: ScraperSection,
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

/** Opens on `params.section` and `params.focusId`, and follows them when the window is reopened. */
export function SettingsApp({ params }: { params?: AppParams }) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(params?.section ?? 'general');
  // A new request each time (`n`), so a second "Fix in Settings" opens its item again; the
  // section stays mounted and keeps its unsaved draft.
  const [focus, setFocus] = useState<FocusRequest | undefined>(
    params?.focusId ? { id: params.focusId, n: 0 } : undefined,
  );
  const [seenParams, setSeenParams] = useState(params);
  if (params !== seenParams) {
    setSeenParams(params);
    if (params?.section) setSelectedId(params.section);
    setFocus(params?.focusId ? { id: params.focusId, n: (focus?.n ?? 0) + 1 } : undefined);
  }
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
              setFocus(undefined);
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none aria-[current=page]:bg-white/15 aria-[current=page]:text-white"
          >
            <section.icon aria-hidden="true" className="h-4 w-4" />
            {t(section.labelKey)}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-auto">
        {selected && <selected.Component key={selected.id} {...(focus ? { focus } : {})} />}
      </div>
    </div>
  );
}
