import { GitHubReleaseSchema } from '@nextlevel/shared';
import { z } from 'zod';
import type { LatestRelease } from './UpdateService.ts';

/** Where releases are published (electron-builder.yml `publish`). */
export const RELEASES_API = 'https://api.github.com/repos/estivalet/next-level-refactor/releases';

const HEADERS = { accept: 'application/vnd.github+json', 'user-agent': 'NextLevel' };

/**
 * The newest release of a channel, for zip copies that can't update themselves: stable = GitHub's
 * latest release; beta = the newest published one, pre-releases included. Null when there is none.
 */
export function createLatestRelease(
  fetch: (url: string, init?: RequestInit) => Promise<Response>,
): LatestRelease {
  return async (channel) => {
    const url = channel === 'stable' ? `${RELEASES_API}/latest` : `${RELEASES_API}?per_page=20`;
    const response = await fetch(url, { headers: HEADERS });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub answered ${String(response.status)}`);
    const body: unknown = await response.json();
    const release =
      channel === 'stable'
        ? GitHubReleaseSchema.parse(body)
        : z
            .array(GitHubReleaseSchema)
            .parse(body)
            .find((candidate) => !candidate.draft);
    return release ? { version: release.tag_name.replace(/^v/, ''), url: release.html_url } : null;
  };
}
