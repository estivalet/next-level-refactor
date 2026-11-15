import type { z } from 'zod';

/** Field errors keyed by the zod path ("models.0.name"); values are i18n keys. */
export type FieldErrors = Record<string, string>;

function messageKey(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'too_small':
    case 'too_big':
      if (issue.origin === 'number') return 'apps.museum.error.year';
      if (issue.origin === 'array') return 'apps.museum.error.tooMany';
      return issue.code === 'too_small'
        ? 'apps.museum.error.required'
        : 'apps.museum.error.tooLong';
    case 'invalid_type':
      return 'apps.museum.error.year';
    case 'invalid_format':
      return 'apps.museum.error.url';
    default:
      return 'apps.museum.error.invalid';
  }
}

/** Maps zod issues to one message per field path (the first issue wins). */
export function fieldErrors(issues: readonly z.core.$ZodIssue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const path = issue.path.join('.');
    errors[path] ??= messageKey(issue);
  }
  return errors;
}
