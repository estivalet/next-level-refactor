import { describe, expect, it } from 'vitest';
import { AppErrorSchema } from './errors.ts';
import { err, ok } from './result.ts';

describe('Result', () => {
  it('NFR-MAINT-1: ok() wraps a value', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
  });

  it('NFR-MAINT-1: err() builds an AppError that the schema accepts', () => {
    const result = err('INTERNAL', 'boom');
    expect(result).toEqual({ ok: false, error: { code: 'INTERNAL', message: 'boom' } });
    if (result.ok) throw new Error('expected an error result');
    expect(() => AppErrorSchema.parse(result.error)).not.toThrow();
  });

  it('NFR-MAINT-1: err() keeps details only when given', () => {
    const result = err('VALIDATION_FAILED', 'bad', { field: 'x' });
    expect(result).toEqual({
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: 'bad', details: { field: 'x' } },
    });
    expect('details' in (err('INTERNAL', 'boom') as { error: object }).error).toBe(false);
  });
});
