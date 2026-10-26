import type { AppSettings } from '@nextlevel/shared';
import { apiError } from '../errors.ts';
import type { UserRepository, UserRow } from '../users/UserRepository.ts';
import type { GoogleIdentity } from './identity.ts';

/**
 * Who may sign in (D22, FR-AUTH-4): `ADMIN_EMAILS`, existing admins and stub personas always;
 * otherwise `open` admits anyone, `allowList` the listed emails, `closed` existing users only.
 * A first sign-in creates the account — admin when the email is in `ADMIN_EMAILS` (bootstrap);
 * later sign-ins refresh the profile from Google and keep the role.
 */
export function admit(
  identity: GoogleIdentity,
  opts: { settings: AppSettings; adminEmails: string[]; users: UserRepository; now: Date },
): UserRow {
  const { settings, adminEmails, users, now } = opts;
  const existing = users.byGoogleSub(identity.sub);
  const bootstrap = adminEmails.includes(identity.email);
  const allowed =
    bootstrap ||
    existing?.role === 'admin' ||
    identity.stub?.allowListed === true ||
    settings.signUpMode === 'open' ||
    (settings.signUpMode === 'allowList' && settings.allowList.includes(identity.email)) ||
    (settings.signUpMode === 'closed' && existing !== undefined);
  if (!allowed) throw apiError('NOT_ALLOWED');
  if (existing) return users.updateProfile(existing.id, identity, now);
  return users.create(
    identity,
    bootstrap ? 'admin' : 'subscriber',
    identity.stub?.suspended ? 'suspended' : 'active',
    now,
  );
}
