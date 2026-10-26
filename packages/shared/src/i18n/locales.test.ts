import { describe, expect, it } from 'vitest';
import { GeneralSchema, fieldMeta } from '../settings/schema.ts';
import en from './en.json';
import ptBR from './pt-BR.json';
import adminEn from './admin.en.json';
import adminPtBR from './admin.pt-BR.json';

function flatten(node: unknown, prefix = ''): Record<string, unknown> {
  if (typeof node !== 'object' || node === null) return { [prefix]: node };
  return Object.entries(node).reduce<Record<string, unknown>>(
    (all, [key, value]) => ({ ...all, ...flatten(value, prefix ? `${prefix}.${key}` : key) }),
    {},
  );
}

describe('locales', () => {
  it('NFR-I18N-1: pt-BR has exactly the same keys as en', () => {
    expect(Object.keys(flatten(ptBR)).sort()).toEqual(Object.keys(flatten(en)).sort());
  });

  it('NFR-I18N-1: the admin console has the same keys in pt-BR, none empty (D27)', () => {
    expect(Object.keys(flatten(adminPtBR)).sort()).toEqual(Object.keys(flatten(adminEn)).sort());
    for (const [key, value] of Object.entries(flatten(adminPtBR))) {
      expect(typeof value === 'string' && value.length > 0, key).toBe(true);
    }
  });

  it('NFR-I18N-1: no translation is empty', () => {
    for (const [key, value] of Object.entries(flatten(ptBR))) {
      expect(typeof value === 'string' && value.length > 0, key).toBe(true);
    }
  });

  it('every settings field label and help key exists in both locales', () => {
    const keys = Object.values(GeneralSchema.shape).flatMap((field) => {
      const meta = fieldMeta(field);
      return meta ? [meta.labelKey, ...(meta.helpKey ? [meta.helpKey] : [])] : [];
    });
    expect(keys.length).toBeGreaterThan(0);
    for (const locale of [flatten(en), flatten(ptBR)]) {
      for (const key of keys) expect(locale[key], key).toBeTypeOf('string');
    }
  });
});
