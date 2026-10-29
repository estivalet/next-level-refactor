import { Library, ListTree, Settings, Store, UserRound, type LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { AccountApp } from '../features/account/AccountApp.tsx';
import { CatalogApp } from '../features/catalog/CatalogApp.tsx';
import { LibraryApp } from '../features/library/LibraryApp.tsx';
import { MenuEditorApp } from '../features/menus/MenuEditorApp.tsx';
import { SettingsApp } from '../features/settings/SettingsApp.tsx';
import type { AppParams } from '../features/shell/windowManager.ts';

export type AppId = 'library' | 'catalog' | 'menu-editor' | 'settings' | 'account';

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
    id: 'catalog',
    titleKey: 'apps.catalog.title',
    icon: Store,
    defaultSize: { width: 1100, height: 720 },
    singleInstance: true,
    Component: CatalogApp,
  },
  {
    id: 'menu-editor',
    titleKey: 'apps.menuEditor.title',
    icon: ListTree,
    defaultSize: { width: 900, height: 640 },
    singleInstance: true,
    Component: MenuEditorApp,
  },
  {
    id: 'settings',
    titleKey: 'apps.settings.title',
    icon: Settings,
    defaultSize: { width: 900, height: 600 },
    singleInstance: true,
    Component: SettingsApp,
  },
  {
    id: 'account',
    titleKey: 'apps.account.title',
    icon: UserRound,
    defaultSize: { width: 640, height: 560 },
    singleInstance: true,
    Component: AccountApp,
  },
];

export function getApp(id: string): AppDefinition | undefined {
  return apps.find((app) => app.id === id);
}
