import { describe, expect, it } from 'vitest';
import { compareVersions, isVersion } from './semver.ts';

describe('semver (NFR-UPD-1)', () => {
  it('accepts x.y.z with an optional pre-release and an optional leading v', () => {
    expect(isVersion('1.0.0')).toBe(true);
    expect(isVersion('v0.10.2')).toBe(true);
    expect(isVersion('1.0.0-beta.1')).toBe(true);
    expect(isVersion('1.0')).toBe(false);
    expect(isVersion('01.0.0')).toBe(false);
    expect(isVersion('1.0.0 ')).toBe(false);
    expect(isVersion('latest')).toBe(false);
  });

  it('orders by major, minor, patch numerically', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('v1.2.3', '1.2.4')).toBe(-1);
    expect(compareVersions('2.0.0', '10.0.0')).toBe(-1);
  });

  it('a pre-release sorts before its release; identifiers compare numerically then by text', () => {
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1);
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1);
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
    expect(compareVersions('1.0.0-beta', '1.0.0-beta.1')).toBe(-1);
    expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1);
  });

  it('throws on something that is not a version', () => {
    expect(() => compareVersions('1.0', '1.0.0')).toThrow();
  });
});
