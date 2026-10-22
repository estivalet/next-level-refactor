import {
  PresetCatalogSchema,
  SystemCatalogSchema,
  type EmulatorPreset,
  type PresetProfile,
  type SystemDefinition,
  type SystemSettings,
} from '@nextlevel/shared';
import presetData from '../data/presets.json' with { type: 'json' };
import data from '../data/systems.json' with { type: 'json' };

/** Every system NextLevelOS knew about when the catalog was seeded (see README). */
export const NEXTLEVELOS_SYSTEM_COUNT = 438;

let cache: readonly SystemDefinition[] | undefined;

/** The shipped system catalog, validated once (FR-EMU-1). */
export function systemCatalog(): readonly SystemDefinition[] {
  cache ??= SystemCatalogSchema.parse(data).systems;
  return cache;
}

export function getSystem(id: string): SystemDefinition | undefined {
  return systemCatalog().find((system) => system.id === id);
}

/** A system's folder name and extensions after the user's overrides (FR-LIB-2). */
export function effectiveSystem(
  def: SystemDefinition,
  settings?: SystemSettings,
): { folderName: string; extensions: string[]; enabled: boolean } {
  return {
    folderName: settings?.folderName ?? def.defaultFolderName,
    extensions: settings?.extensions ?? def.extensions,
    enabled: settings?.enabled ?? false,
  };
}

let presetCache: readonly EmulatorPreset[] | undefined;

/** The shipped emulator presets, validated once (FR-EMU-7). */
export function emulatorPresets(): readonly EmulatorPreset[] {
  presetCache ??= PresetCatalogSchema.parse(presetData).presets;
  return presetCache;
}

export function getPreset(id: string): EmulatorPreset | undefined {
  return emulatorPresets().find((preset) => preset.id === id);
}

/** A preset profile by id (`retroarch:<core>`, `mame:<system>`, `<preset>:default`). */
export function getPresetProfile(
  id: string,
): { preset: EmulatorPreset; profile: PresetProfile } | undefined {
  for (const preset of emulatorPresets()) {
    const profile = preset.profiles.find((p) => p.id === id);
    if (profile) return { preset, profile };
  }
  return undefined;
}

/** The preset whose executable has this file name, ignoring case. */
export function presetForExecutable(fileName: string): EmulatorPreset | undefined {
  const name = fileName.toLowerCase();
  return emulatorPresets().find((preset) =>
    preset.executableNames.some((exe) => exe.toLowerCase() === name),
  );
}
