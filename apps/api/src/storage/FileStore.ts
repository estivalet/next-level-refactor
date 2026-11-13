import type { Readable } from 'node:stream';

/**
 * Where catalog files, art and license evidence live (ADR-012, D40): the local disk in M9, R2
 * (S3) with production in M10. Keys are made by the API only, never from input:
 * `files/<itemId>/<fileId>`, `media/<itemId>/<kind>/<version>`, `evidence/<licenseId>/<uuid>`.
 */
export interface FileStore {
  /**
   * Streams `body` to `key`, hashing as it writes; replaces any file there only once the whole
   * body arrived. More than `limit` bytes → `VALIDATION_FAILED` (`tooLarge`), nothing kept.
   */
  put(key: string, body: Readable, limit: number): Promise<{ size: number; sha256: string }>;
  /** The file, or an inclusive byte range of it; a missing file rejects with code `ENOENT`. */
  open(key: string, range?: { start: number; end: number }): Promise<Readable>;
  /** Bytes, or null when there is no such file. */
  size(key: string): Promise<number | null>;
  /** Removes the file; a missing one is fine. */
  delete(key: string): Promise<void>;
  /**
   * A URL the launcher downloads `key` from directly (a presigned R2 GET, D57), or null when the
   * API serves it itself through `/v1/files/:token` (the local disk). No I/O: the URL is signed
   * here. `filename` names the download.
   */
  downloadUrl(key: string, opts: { expiresInSeconds: number; filename?: string }): string | null;
  /** Every file under `prefix` (the orphan sweep). */
  list(prefix: string): AsyncIterable<StoredFile>;
}

export interface StoredFile {
  key: string;
  size: number;
  modifiedAt: Date;
}

/** Store keys: lowercase-safe segments separated by `/`, never `.`/`..` or empty. */
const KEY = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_.-]+)*$/;

export function checkKey(key: string): void {
  if (!KEY.test(key) || key.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error(`Bad store key: ${key}`);
  }
}
