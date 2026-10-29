import { imageType } from '../scraper/sniff.ts';

const IMAGE_FORMATS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
const VIDEO_FORMATS: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm' };

/**
 * One catalog art file by its signed media URL (FR-CAT-3). The API serves art as octet-stream,
 * so an image's format comes from its bytes, a video's from the type; anything else, a refusal or
 * no network is null (the install goes on without that art). The URL is never logged.
 */
export async function fetchArt(
  url: string,
  fetcher: typeof fetch,
): Promise<{ bytes: Buffer; format: string } | null> {
  try {
    const response = await fetcher(url);
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    const image = imageType(bytes);
    const type = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
    const format = image ? IMAGE_FORMATS[image] : VIDEO_FORMATS[type];
    return format ? { bytes, format } : null;
  } catch {
    return null;
  }
}
