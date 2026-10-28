import { describe, expect, it } from 'vitest';
import {
  CatalogQuerySchema,
  CompleteUploadSchema,
  CreateItemSchema,
  InstallStatusRequestSchema,
  LicenseInputSchema,
  StartUploadSchema,
  UpdateItemSchema,
} from './catalog.ts';

describe('catalog contracts (FR-CAT-2, FR-CAT-8, FR-ADM-3)', () => {
  it('CreateItem takes a lowercase slug of at most 60 characters', () => {
    const item = { slug: 'star-hopper', title: 'Star Hopper', systemId: 'nes', scopeSlug: 'demos' };
    expect(CreateItemSchema.safeParse(item).success).toBe(true);
    expect(CreateItemSchema.safeParse({ ...item, slug: 'Star Hopper' }).success).toBe(false);
    expect(CreateItemSchema.safeParse({ ...item, slug: 'a'.repeat(61) }).success).toBe(false);
    expect(CreateItemSchema.safeParse({ ...item, title: ' ' }).success).toBe(false);
  });

  it('UpdateItem: description up to 4000 characters, at least one field, nothing unknown', () => {
    expect(UpdateItemSchema.safeParse({ description: 'x'.repeat(4000) }).success).toBe(true);
    expect(UpdateItemSchema.safeParse({ description: 'x'.repeat(4001) }).success).toBe(false);
    expect(UpdateItemSchema.safeParse({}).success).toBe(false);
    expect(UpdateItemSchema.safeParse({ status: 'published' }).success).toBe(false);
    expect(UpdateItemSchema.safeParse({ onLapse: 'remove', starter: true }).success).toBe(true);
    expect(UpdateItemSchema.safeParse({ onLapse: 'delete' }).success).toBe(false);
  });

  it('a license has one of the five content-policy types', () => {
    const license = {
      type: 'author-permission',
      rightsHolder: 'Pixel Pals',
      contact: 'pals@example.test',
      terms: 'May be distributed by NextLevel.',
    };
    expect(LicenseInputSchema.safeParse(license).success).toBe(true);
    expect(LicenseInputSchema.safeParse({ ...license, type: 'abandonware' }).success).toBe(false);
    expect(
      LicenseInputSchema.safeParse({ ...license, expiresAt: '2027-01-01T00:00:00.000Z' }).success,
    ).toBe(true);
  });

  it('an upload names a safe filename and a role; a client checksum is 64 hex', () => {
    expect(StartUploadSchema.safeParse({ filename: 'hop.nes', role: 'rom' }).success).toBe(true);
    expect(StartUploadSchema.safeParse({ filename: '../hop.nes', role: 'rom' }).success).toBe(
      false,
    );
    expect(StartUploadSchema.safeParse({ filename: 'hop.nes', role: 'bios' }).success).toBe(false);
    expect(CompleteUploadSchema.safeParse({ sha256: 'a'.repeat(64) }).success).toBe(true);
    expect(CompleteUploadSchema.safeParse({ sha256: 'xyz' }).success).toBe(false);
    expect(CompleteUploadSchema.safeParse({}).success).toBe(true);
  });

  it('catalog pages take a limit of 1–100 (default 50) and q of at most 100 characters', () => {
    expect(CatalogQuerySchema.parse({}).limit).toBe(50);
    expect(CatalogQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(CatalogQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(CatalogQuerySchema.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
  });

  it('install status asks about at most 5,000 items', () => {
    const items = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `i${String(i)}`, version: 1 }));
    expect(InstallStatusRequestSchema.safeParse({ items: items(5000) }).success).toBe(true);
    expect(InstallStatusRequestSchema.safeParse({ items: items(5001) }).success).toBe(false);
  });
});
