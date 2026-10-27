import { z } from 'zod';
import { DeviceSchema } from '../api/auth.ts';
import {
  CheckoutRequestSchema,
  DeleteAccountRequestSchema,
  PlansResponseSchema,
} from '../api/billing.ts';
import { AuthStateSchema } from '../auth/state.ts';

const deviceId = z.string().min(1).max(100);

/** Launcher sign-in channels (api-spec §3 Auth, FR-AUTH-2..8). Spread into `ipcContract`. */
export const authContract = {
  'auth.state': { input: z.void(), output: AuthStateSchema },
  /** Opens the browser and resolves when the sign-in ends (signed in, refused or cancelled). */
  'auth.signIn': { input: z.void(), output: AuthStateSchema },
  'auth.cancelSignIn': { input: z.void(), output: AuthStateSchema },
  /** Removes the tokens from this PC; the library stays (FR-AUTH-6). */
  'auth.signOut': { input: z.void(), output: AuthStateSchema },
  /** Checks the entitlement now (Account → Refresh). */
  'auth.refreshEntitlement': { input: z.void(), output: AuthStateSchema },
  /** Device limit reached: removes that device and finishes the sign-in (US-A4). */
  'auth.resolveDeviceLimit': {
    input: z.strictObject({ revokeDeviceId: deviceId }),
    output: AuthStateSchema,
  },
  'auth.devices.list': { input: z.void(), output: z.array(DeviceSchema) },
  'auth.devices.revoke': {
    input: z.strictObject({ deviceId }),
    output: z.array(DeviceSchema),
  },
  /** The plans on sale (S3); no sign-in needed. */
  'auth.plans': { input: z.void(), output: PlansResponseSchema },
  /** Opens Stripe Checkout in the browser and waits for the payment (IA F7, US-A2). */
  'auth.openCheckout': { input: CheckoutRequestSchema, output: AuthStateSchema },
  /** Opens the Stripe Customer Portal in the browser (S12 Manage billing). */
  'auth.openPortal': { input: z.void(), output: z.void() },
  /** "Choose another plan": stops waiting for the payment. */
  'auth.stopWaiting': { input: z.void(), output: AuthStateSchema },
  /** Download my data: main fetches it and asks where to save it (security §5). */
  'account.export': { input: z.void(), output: z.object({ saved: z.boolean() }) },
  /** Delete account, confirmed by the typed email; signs out with reason `deleted` (D36). */
  'account.delete': { input: DeleteAccountRequestSchema, output: AuthStateSchema },
} as const;
