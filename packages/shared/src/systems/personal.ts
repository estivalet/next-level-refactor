import { z } from 'zod';

export const MUSEUM_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const;
export const MUSEUM_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
export const MUSEUM_GALLERY_MAX = 50;
export const MUSEUM_CAPTION_MAX = 200;

/** A gallery file name: the launcher names every stored image `<uuid>.<ext>` (FR-MUS-8). */
export const MUSEUM_IMAGE_FILE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|gif)$/;

export const SystemGalleryImageSchema = z.object({
  file: z.string().regex(MUSEUM_IMAGE_FILE),
  caption: z.string().trim().min(1).max(MUSEUM_CAPTION_MAX).optional(),
});

/** The owner's own notes and images for a system, kept apart from the museum entry (FR-MUS-6, FR-MUS-8). */
export const SystemPersonalSchema = z
  .object({
    systemId: z.string().min(1).max(100),
    notes: z.string().trim().min(1).max(20000).optional(),
    gallery: z.array(SystemGalleryImageSchema).max(MUSEUM_GALLERY_MAX).default([]),
  })
  .refine(
    (personal) =>
      new Set(personal.gallery.map((image) => image.file)).size === personal.gallery.length,
    {
      message: 'gallery files must be unique',
      path: ['gallery'],
    },
  );

export type SystemGalleryImage = z.output<typeof SystemGalleryImageSchema>;
export type SystemPersonal = z.output<typeof SystemPersonalSchema>;
/**
 * An image the owner picked that was not added: `unreadable` when the picked file could not be
 * read, `copy` when copying it into the museum folder failed (disk full, a locked folder).
 */
export type RejectedImage = { name: string; reason: 'type' | 'size' | 'unreadable' | 'copy' };

export function emptyPersonal(systemId: string): SystemPersonal {
  return { systemId, gallery: [] };
}
