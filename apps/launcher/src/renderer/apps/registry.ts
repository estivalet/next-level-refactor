import { Library, Settings, type LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { LibraryApp } from '../features/library/LibraryApp.tsx';
import { SettingsApp } from '../features/settings/SettingsApp.tsx';
import type { AppParams } from '../features/shell/windowManager.ts';

export type AppId = 'library' | 'settings';

export interface AppDefinition {
  id: AppId;
  titleKey: string;
  icon: LucideIcon;
  defaultSize: { width: number; height: number };
  /** Whether opening the app again focuses the existing window (FR-SHELL-3). */
  singleInstance: boolean;
  Component: ComponentType<{ params?: AppParams }>;
}

/** Every app the shell can open, in desktop and Start menu order. */
export const apps: readonly AppDefinition[] = [
  {
    id: 'library',
    titleKey: 'apps.library.title',
    icon: Library,
    defaultSize: { width: 1200, height: 720 },
    singleInstance: true,
    Component: LibraryApp,
  },
  {
    id: 'settings',
    titleKey: 'apps.settings.title',
    icon: Settings,
    defaultSize: { width: 900, height: 600 },
    singleInstance: true,
    Component: SettingsApp,
  },
];

export function getApp(id: string): AppDefinition | undefined {
  return apps.find((app) => app.id === id);
}
