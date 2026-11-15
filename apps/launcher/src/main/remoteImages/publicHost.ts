/**
 * Whether main may fetch a museum image from this URL (FR-MUS-4). The renderer supplies the whole
 * URL, so main must not become a way to probe the user's own machine or network: only https URLs
 * on public hosts, no userinfo, no loopback / private / link-local / CGNAT / `.local` names.
 */
export function isPublicHttpsUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host === '') return false;
  if (host.startsWith('[')) return !isPrivateV6(host.slice(1, -1));
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
  // `new URL` has already normalised any numeric form (hex, octal, short) to dotted decimal.
  if (/^[\d.]+$/.test(host)) {
    const octets = host.split('.').map(Number);
    return octets.length === 4 && !isPrivateV4(octets);
  }
  return true;
}

function isPrivateV4([a = 0, b = 0]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** The 8 16-bit groups of a canonical IPv6 literal, or null when it does not parse. */
function groupsOf(address: string): number[] | null {
  const [head = '', tail, ...extra] = address.split('::');
  if (extra.length > 0) return null;
  const parse = (part: string) => (part === '' ? [] : part.split(':'));
  const left = parse(head);
  const right = tail === undefined ? [] : parse(tail);
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? missing !== 0 : missing < 1) return null;
  const all = [...left, ...Array<string>(tail === undefined ? 0 : missing).fill('0'), ...right];
  const groups = all.map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  return groups.some(Number.isNaN) ? null : groups;
}

function isPrivateV6(address: string): boolean {
  const g = groupsOf(address);
  if (!g) return true; // unparseable: refuse
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = g;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0) {
    if (g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) return true; // :: and ::1
    // IPv4-mapped (::ffff:a.b.c.d) and the deprecated IPv4-compatible (::a.b.c.d)
    if (g5 === 0xffff || g5 === 0) {
      return isPrivateV4([g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff]);
    }
  }
  return (g0 & 0xffc0) === 0xfe80 || (g0 & 0xfe00) === 0xfc00;
}
