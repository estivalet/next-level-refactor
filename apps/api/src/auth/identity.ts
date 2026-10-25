// Who a sign-in says the user is, from Google or the development stub (ADR-006).

export interface GoogleIdentity {
  sub: string;
  /** Lowercased; Google said it is verified. */
  email: string;
  name: string;
  avatarUrl: string | null;
  /** Stub personas only: admitted whatever the sign-up mode, and created suspended. */
  stub?: { allowListed: boolean; suspended: boolean };
}

export interface ExchangeInput {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

/** One OAuth client: the launcher's Desktop client or the console's Web client. */
export interface IdentityProvider {
  readonly authorizeUrl: string;
  readonly clientId: string;
  /** Exchanges an authorization code; any failure throws `UNAUTHENTICATED`. */
  exchange(input: ExchangeInput): Promise<GoogleIdentity>;
}

export interface IdentityProviders {
  desktop: IdentityProvider;
  web: IdentityProvider;
}

export const SCOPES = ['openid', 'email', 'profile'];
