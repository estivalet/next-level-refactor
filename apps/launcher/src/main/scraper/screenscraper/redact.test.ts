import { describe, expect, it } from 'vitest';
import { redact } from './redact.ts';

describe('redact (FR-SCR-3)', () => {
  it('masks every credential parameter, ported case', () => {
    expect(redact('u?devid=a&devpassword=b c&ssid=d&sspassword=e')).toBe(
      'u?devid=***&devpassword=*** c&ssid=***&sspassword=***',
    );
  });

  it('masks URL-encoded values and keeps other parameters', () => {
    expect(
      redact('https://x/api2/jeuInfos.php?devid=a%20b&devpassword=p%26q&softname=NextLevel&x=1'),
    ).toBe('https://x/api2/jeuInfos.php?devid=***&devpassword=***&softname=NextLevel&x=1');
  });

  it('accepts anything printable', () => {
    expect(redact(new Error('fetch failed: https://x/?ssid=me'))).toBe(
      'Error: fetch failed: https://x/?ssid=***',
    );
  });
});
