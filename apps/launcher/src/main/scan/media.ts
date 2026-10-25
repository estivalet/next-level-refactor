import { MEDIA_KIND } from '@nextlevel/shared';

/** A file under `<system folder>/media/<kind>/`, as the walk found it. */
export interface MediaFile {
  /** The folder name, as on disk. */
  kind: string;
  path: string;
  size: number;
  /** mtime in ms. */
  mtime: number;
  /** From the central media folder (FR-SCR-4): wins over per-ROM files of the same kind. */
  central?: boolean;
}

export interface GameMediaRow {
  gameId: number;
  kind: string;
  path: string;
  size: number;
  /** The file's mtime in ms, truncated; `mediaUrl` carries it (FR-SCR-5). */
  version: number;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const VIDEO_EXTENSIONS = ['mp4', 'webm'];

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const key = (stem: string) => stem.normalize('NFC').toLowerCase();

function split(name: string): { stem: string; ext: string } | null {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return null;
  return { stem: name.slice(0, dot), ext: name.slice(dot + 1).toLowerCase() };
}

/** Lower is better; -1 = not a media file for this kind. */
function rank(kind: string, ext: string): number {
  return (kind === 'video' ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS).indexOf(ext);
}

/**
 * Matches media files to games by file stem (case-insensitive) and keeps one file per game and
 * kind: a central file first (FR-SCR-4), then png > jpg > jpeg > webp > gif for images, mp4 >
 * webm for `video` (FR-THM-2). Kind
 * folders whose lowercase name is not a valid kind are skipped.
 */
export function matchMedia(
  games: ReadonlyArray<{ id: number; relPath: string }>,
  files: readonly MediaFile[],
): GameMediaRow[] {
  const byStem = new Map<string, number>();
  for (const game of games) {
    const parts = split(fileName(game.relPath));
    byStem.set(key(parts ? parts.stem : fileName(game.relPath)), game.id);
  }
  const best = new Map<string, { row: GameMediaRow; rank: number }>();
  for (const file of files) {
    const kind = file.kind.toLowerCase();
    const parts = split(fileName(file.path));
    if (!MEDIA_KIND.test(kind) || !parts) continue;
    const gameId = byStem.get(key(parts.stem));
    const formatRank = rank(kind, parts.ext);
    if (gameId === undefined || formatRank < 0) continue;
    const fileRank = (file.central ? 0 : 100) + formatRank;
    const slot = `${String(gameId)}/${kind}`;
    const current = best.get(slot);
    if (!current || fileRank < current.rank) {
      best.set(slot, {
        row: {
          gameId,
          kind,
          path: file.path,
          size: file.size,
          version: Math.trunc(file.mtime),
        },
        rank: fileRank,
      });
    }
  }
  return [...best.values()].map((entry) => entry.row);
}
