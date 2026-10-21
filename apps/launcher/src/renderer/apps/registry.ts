import { Settings, type LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { SettingsApp } from '../features/settings/SettingsApp.tsx';

export type AppId = 'settings';

export interface AppDefinition {
  id: AppId;
  titleKey: string;
  icon: LucideIcon;
  defaultSize: { width: number; height: number };
  /** Whether opening the app again focuses the existing window (FR-SHELL-3). */
  singleInstance: boolean;
  Component: ComponentType;
}

/** Every app the shell can open, in desktop and Start menu order. */
export const apps: readonly AppDefinition[] = [
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
