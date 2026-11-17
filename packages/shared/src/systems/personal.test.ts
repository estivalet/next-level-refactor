import { describe, expect, it } from 'vitest';
import { MUSEUM_CAPTION_MAX, SystemPersonalSchema, emptyPersonal } from './personal.ts';

const UUID = '123e4567-e89b-42d3-a456-426614174000';
const UUID2 = '123e4567-e89b-42d3-a456-426614174001';

describe('system personal record', () => {
  it('FR-MUS-6: notes are trimmed and capped at 20000', () => {
    const parsed = SystemPersonalSchema.parse({ systemId: 'snes', notes: '  hello  ' });
    expect(parsed.notes).toBe('hello');
    expect(
      SystemPersonalSchema.safeParse({ systemId: 'snes', notes: 'a'.repeat(20000) }).success,
    ).toBe(true);
    expect(
      SystemPersonalSchema.safeParse({ systemId: 'snes', notes: 'a'.repeat(20001) }).success,
    ).toBe(false);
  });

  it('FR-MUS-8: gallery accepts <uuid>.png and rejects "../x.png", "a.bmp", duplicate files, 51 items', () => {
    const gallery = (files: string[]) =>
      SystemPersonalSchema.safeParse({
        systemId: 'snes',
        gallery: files.map((file) => ({ file })),
      });
    expect(gallery([`${UUID}.png`]).success).toBe(true);
    expect(gallery(['../x.png']).success).toBe(false);
    expect(gallery(['a.bmp']).success).toBe(false);
    expect(gallery([`${UUID}.png`, `${UUID}.png`]).success).toBe(false);
    const many = Array.from(
      { length: 51 },
      (_, i) => `123e4567-e89b-42d3-a456-${String(i).padStart(12, '0')}.png`,
    );
    expect(gallery(many).success).toBe(false);
    expect(gallery(many.slice(0, 50)).success).toBe(true);
    expect(gallery([`${UUID}.png`, `${UUID2}.png`]).success).toBe(true);
  });

  it('FR-MUS-8: caption is trimmed, ≤ MUSEUM_CAPTION_MAX (200)', () => {
    expect(MUSEUM_CAPTION_MAX).toBe(200);
    const parse = (caption: string) =>
      SystemPersonalSchema.safeParse({
        systemId: 'snes',
        gallery: [{ file: `${UUID}.png`, caption }],
      });
    const ok = parse('  my console  ');
    expect(ok.success && ok.data.gallery[0]?.caption).toBe('my console');
    expect(parse('a'.repeat(200)).success).toBe(true);
    expect(parse('a'.repeat(201)).success).toBe(false);
  });

  it('FR-MUS-6: emptyPersonal has no notes and an empty gallery', () => {
    expect(emptyPersonal('snes')).toEqual({ systemId: 'snes', gallery: [] });
  });
});
