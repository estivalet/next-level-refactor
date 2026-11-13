import { describe, expect, it, vi } from 'vitest';
import { createLatestRelease, RELEASES_API } from './latestRelease.ts';

const release = (tag: string, o: { draft?: boolean; prerelease?: boolean } = {}) => ({
  tag_name: tag,
  html_url: `https://github.com/estivalet/next-level-refactor/releases/tag/${tag}`,
  draft: o.draft ?? false,
  prerelease: o.prerelease ?? false,
});

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('latest release for zip copies (NFR-UPD-1, D53)', () => {
  it('stable asks GitHub for the latest release and drops the v of the tag', async () => {
    const fetch = vi.fn<(url: string) => Promise<Response>>(() => reply(release('v1.0.1')));
    const latest = createLatestRelease(fetch);
    expect(await latest('stable')).toEqual({
      version: '1.0.1',
      url: 'https://github.com/estivalet/next-level-refactor/releases/tag/v1.0.1',
    });
    expect(fetch.mock.calls[0]?.[0]).toBe(`${RELEASES_API}/latest`);
  });

  it('beta takes the newest published release, pre-releases included, never a draft', async () => {
    const fetch = vi.fn<(url: string) => Promise<Response>>(() =>
      reply([
        release('v1.2.0', { draft: true }),
        release('v1.1.0-beta.1', { prerelease: true }),
        release('v1.0.1'),
      ]),
    );
    expect(await createLatestRelease(fetch)('beta')).toEqual({
      version: '1.1.0-beta.1',
      url: 'https://github.com/estivalet/next-level-refactor/releases/tag/v1.1.0-beta.1',
    });
  });

  it('no release yet (404) → null; a reply that is not a release → throws', async () => {
    expect(await createLatestRelease(() => reply({ message: 'Not Found' }, 404))('stable')).toBe(
      null,
    );
    await expect(createLatestRelease(() => reply({ nope: 1 }))('stable')).rejects.toThrow();
  });
});
