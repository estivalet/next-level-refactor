/**
 * Whether downloaded bytes are an image NextLevel can show (PNG, JPEG, WebP, GIF). ScreenScraper
 * sometimes answers 200 with a text or HTML body; writing that would replace good art.
 */
export function isImage(bytes: Buffer): boolean {
  const starts = (...sig: number[]) => sig.every((byte, i) => bytes[i] === byte);
  return (
    starts(0x89, 0x50, 0x4e, 0x47) ||
    starts(0xff, 0xd8, 0xff) ||
    starts(0x47, 0x49, 0x46, 0x38) ||
    (starts(0x52, 0x49, 0x46, 0x46) && bytes.subarray(8, 12).toString('latin1') === 'WEBP')
  );
}
