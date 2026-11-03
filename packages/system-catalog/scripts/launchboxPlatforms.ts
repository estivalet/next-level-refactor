// LaunchBox Games Database platform names per system (FR-SCR-6), matched from LaunchBox's
// `Platforms.xml` (inside its public Metadata.zip). Dev-only, like the seed.

export interface LaunchBoxPlatform {
  name: string;
  alternates: string[];
}

export interface PlatformSystem {
  name: string;
  aliases?: readonly string[] | undefined;
  defaultFolderName: string;
  manufacturer?: string | undefined;
}

const decode = (value: string): string =>
  value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');

const field = (block: string, tag: string): string | null => {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(block);
  return match?.[1] === undefined ? null : decode(match[1]).trim();
};

/** Every `<Platform>` with the `<PlatformAlternateName>` rows that name it, in file order. */
export function parsePlatforms(xml: string): LaunchBoxPlatform[] {
  const platforms = new Map<string, LaunchBoxPlatform>();
  for (const [, block = ''] of xml.matchAll(/<Platform>([\s\S]*?)<\/Platform>/g)) {
    const name = field(block, 'Name');
    if (name) platforms.set(name, { name, alternates: [] });
  }
  for (const [, block = ''] of xml.matchAll(
    /<PlatformAlternateName>([\s\S]*?)<\/PlatformAlternateName>/g,
  )) {
    const name = field(block, 'Name');
    const alternate = field(block, 'Alternate');
    if (name && alternate) platforms.get(name)?.alternates.push(alternate);
  }
  return [...platforms.values()];
}

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The platform whose name or an alternate equals (ignoring case and punctuation) the system's
 * name, an alias, its folder name or manufacturer + name; null when none does.
 */
export function matchPlatform(
  system: PlatformSystem,
  platforms: readonly LaunchBoxPlatform[],
): string | null {
  const wanted = new Set(
    [
      system.name,
      ...(system.aliases ?? []),
      system.defaultFolderName,
      ...(system.manufacturer ? [`${system.manufacturer} ${system.name}`] : []),
    ].map(normalize),
  );
  for (const platform of platforms) {
    if ([platform.name, ...platform.alternates].some((name) => wanted.has(normalize(name)))) {
      return platform.name;
    }
  }
  return null;
}
