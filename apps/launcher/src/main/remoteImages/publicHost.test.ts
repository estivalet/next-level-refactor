import { describe, expect, it } from 'vitest';
import { isPublicHttpsUrl } from './publicHost.ts';

describe('isPublicHttpsUrl', () => {
  it.each([
    'https://example.com/a.png',
    'https://images.example.co.uk:8443/a.png?x=1',
    'https://8.8.8.8/a.png',
    'https://172.15.0.1/a.png',
    'https://172.32.0.1/a.png',
    'https://100.63.0.1/a.png',
    'https://100.128.0.1/a.png',
    'https://[2606:4700::1111]/a.png',
  ])('FR-MUS-4: allows %s', (url) => {
    expect(isPublicHttpsUrl(url)).toBe(true);
  });

  it.each([
    'http://example.com/a.png',
    'ftp://example.com/a.png',
    'not a url',
    'https://user:pw@example.com/a.png',
    'https://user@example.com/a.png',
    'https://localhost/a.png',
    'https://LOCALHOST./a.png',
    'https://app.localhost/a.png',
    'https://printer.local/a.png',
    'https://127.0.0.1:8443/a.png',
    'https://127.1/a.png',
    'https://0x7f.0.0.1/a.png',
    'https://2130706433/a.png',
    'https://0.0.0.0/a.png',
    'https://10.1.2.3/a.png',
    'https://172.16.0.1/a.png',
    'https://172.31.255.255/a.png',
    'https://192.168.1.10/a.png',
    'https://169.254.169.254/a.png',
    'https://100.64.0.1/a.png',
    'https://100.127.255.255/a.png',
    'https://[::1]/a.png',
    'https://[::]/a.png',
    'https://[fe80::1]/a.png',
    'https://[febf::1]/a.png',
    'https://[fc00::1]/a.png',
    'https://[fd12:3456::1]/a.png',
    'https://[::ffff:127.0.0.1]/a.png',
    'https://[::ffff:192.168.1.1]/a.png',
    'https://[::ffff:10.0.0.1]/a.png',
    'https://[::127.0.0.1]/a.png',
  ])('FR-MUS-4: refuses %s', (url) => {
    expect(isPublicHttpsUrl(url)).toBe(false);
  });

  it('FR-MUS-4: allows an IPv4-mapped public address', () => {
    expect(isPublicHttpsUrl('https://[::ffff:8.8.8.8]/a.png')).toBe(true);
  });
});
