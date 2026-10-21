import { fieldMeta } from '@nextlevel/shared';
import { z } from 'zod';

interface FieldBase {
  path: string;
  labelKey: string;
  helpKey?: string;
}

export type FieldDescriptor =
  (FieldBase & { kind: 'boolean' }) | (FieldBase & { kind: 'enum'; options: readonly string[] });

const KNOWN_ISSUES = new Set(['invalid_type', 'invalid_value', 'too_small', 'too_big']);
/** Custom schema checks carry their message key as the issue message. */
const CUSTOM_ISSUES = new Set(['notAbsolute', 'duplicatePath', 'duplicateName']);

function messageKey(issue: z.core.$ZodIssue): string {
  if (issue.code === 'custom' && CUSTOM_ISSUES.has(issue.message)) return issue.message;
  return KNOWN_ISSUES.has(issue.code) ? issue.code : 'default';
}

/**
 * The editable fields of a settings section, from schema metadata (FR-SET-1). A field kind
 * without a widget throws, so adding one is a deliberate change.
 */
export function fieldsOf(section: z.ZodObject, prefix: string): FieldDescriptor[] {
  return Object.entries(section.shape as Record<string, z.ZodType>).flatMap(
    ([key, field]): FieldDescriptor[] => {
      const meta = fieldMeta(field);
      if (!meta) return [];
      const inner = field instanceof z.ZodDefault ? field.unwrap() : field;
      const base = { path: `${prefix}.${key}`, ...meta };
      if (inner instanceof z.ZodBoolean) return [{ ...base, kind: 'boolean' }];
      if (inner instanceof z.ZodEnum)
        return [{ ...base, kind: 'enum', options: inner.options.map(String) }];
      throw new Error(`unsupported field kind at ${base.path}`);
    },
  );
}

/** Dotted field path → message key for the first problem with that field (FR-SET-2). */
export function issuesByPath(error: z.ZodError): Record<string, string> {
  const byPath: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    byPath[path] ??= `errors.validation.${messageKey(issue)}`;
  }
  return byPath;
}

export function getAt(value: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[key]
          : undefined,
      value,
    );
}

/** A copy of `value` with `path` set; untouched branches are shared. */
export function setAt<T>(value: T, path: string, next: unknown): T {
  const [key = '', ...rest] = path.split('.');
  const record = value as Record<string, unknown>;
  return {
    ...record,
    [key]: rest.length ? setAt(record[key], rest.join('.'), next) : next,
  } as T;
}
