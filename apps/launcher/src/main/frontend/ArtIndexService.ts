import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseThemeManifest, type ArtIndex, type ThemeManifest } from '@nextlevel/shared';

export interface ArtIndexDeps {
  paths: () => { assetsPath: string | null; themesPath: string | null };
}

/** Art lives at most `<kind>/<style>/<sub>/<file>` deep. */
const MAX_DEPTH = 4;
/** Art the owner keeps but doesn't use; never indexed (NextLevelOS convention). */
const UNSORTED = '_unsorted_do_not_delete';
const MANIFEST = 'theme.json';

type Listing = { files: string[]; status: 'ok' | 'missing' | 'unreadable' };

/** Every file under `root` up to MAX_DEPTH, as `/`-separated relative paths. */
async function listArt(root: string): Promise<Listing> {
  const files: string[] = [];
  const walk = async (dir: string, prefix: string, depth: number): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isFile()) files.push(rel);
      else if (entry.isDirectory() && depth < MAX_DEPTH && entry.name.toLowerCase() !== UNSORTED) {
        // A sub-folder that can't be read is skipped; only the root decides the status.
        await walk(join(dir, entry.name), rel, depth + 1).catch(() => undefined);
      }
    }
  };
  try {
    await walk(root, '', 1);
    return { files, status: 'ok' };
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    return { files: [], status: missing ? 'missing' : 'unreadable' };
  }
}

async function readManifest(
  packRoot: string,
  themeId: string,
): Promise<{ manifest: ThemeManifest | null; warnings: string[] }> {
  let text: string;
  try {
    text = await readFile(join(packRoot, MANIFEST), 'utf8');
  } catch {
    return { manifest: null, warnings: [] };
  }
  try {
    return parseThemeManifest(JSON.parse(text) as unknown, themeId);
  } catch {
    return { manifest: null, warnings: ['theme.json is not valid JSON; ignored'] };
  }
}

/**
 * The art files a theme can use (FR-THM-2): its pack (`<themesPath>/<themeId>`) and the shared
 * art folder, plus the pack's `theme.json`. Cached per theme until `refresh` or a folder change.
 */
export class ArtIndexService {
  private cache = new Map<string, Promise<ArtIndex>>();
  private cachedFor = '';

  constructor(private readonly deps: ArtIndexDeps) {}

  index(themeId: string, opts: { refresh?: boolean } = {}): Promise<ArtIndex> {
    const paths = this.deps.paths();
    const pathsKey = `${paths.assetsPath ?? ''}\u0000${paths.themesPath ?? ''}`;
    if (pathsKey !== this.cachedFor || opts.refresh) {
      this.cache.clear();
      this.cachedFor = pathsKey;
    }
    let entry = this.cache.get(themeId);
    if (!entry) {
      entry = this.build(themeId, paths);
      this.cache.set(themeId, entry);
    }
    return entry;
  }

  private async build(
    themeId: string,
    paths: { assetsPath: string | null; themesPath: string | null },
  ): Promise<ArtIndex> {
    const warnings: string[] = [];
    const packRoot = paths.themesPath ? join(paths.themesPath, themeId) : null;
    const [pack, assets, manifest] = await Promise.all([
      packRoot ? listArt(packRoot) : Promise.resolve<Listing>({ files: [], status: 'missing' }),
      paths.assetsPath
        ? listArt(paths.assetsPath)
        : Promise.resolve<Listing>({ files: [], status: 'ok' }),
      packRoot
        ? readManifest(packRoot, themeId)
        : Promise.resolve({ manifest: null, warnings: [] }),
    ]);
    // No pack is normal; a set art folder that is missing or unreadable is worth a notice.
    if (pack.status === 'unreadable' || assets.status !== 'ok')
      warnings.push('artFolderUnreadable');
    warnings.push(...manifest.warnings);
    return {
      packFiles: pack.files.filter((file) => file !== MANIFEST),
      assetsFiles: assets.files,
      manifest: manifest.manifest,
      warnings,
    };
  }
}
