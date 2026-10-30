import type { FileStore } from './storage/FileStore.ts';
import { LocalDiskStore } from './storage/LocalDiskStore.ts';
import { MAX_UPLOAD_BYTES, type AppSettings } from '@nextlevel/shared';
import { v7 as uuidv7 } from 'uuid';
import { jwtKeys, type JwtKeys } from './auth/tokens.ts';
import { TokenService } from './auth/TokenService.ts';
import type { BillingProvider } from './billing/provider.ts';
import type { ApiDb } from './db/open.ts';
import type { Env } from './env.ts';
import { PlanRepository } from './plans/PlanRepository.ts';
import { ScopeRepository } from './plans/ScopeRepository.ts';
import { SubscriptionRepository } from './subscriptions/SubscriptionRepository.ts';
import { loadAppSettings } from './settings/AppSettingsRepository.ts';
import { DeviceRepository } from './users/DeviceRepository.ts';
import { UserRepository } from './users/UserRepository.ts';

/** What routes share: config, clock, repositories and the token service. */
export interface ApiContext {
  env: Env;
  db: ApiDb;
  clock: () => Date;
  newId: () => string;
  keys: JwtKeys;
  users: UserRepository;
  devices: DeviceRepository;
  tokens: TokenService;
  plans: PlanRepository;
  scopes: ScopeRepository;
  subscriptions: SubscriptionRepository;
  /** Null when no provider is configured (`Env.billing.mode` `none`). */
  billing: BillingProvider | null;
  settings: () => AppSettings;
  /** Catalog files, art and license evidence (D40). */
  files: FileStore;
  /** Upload limits in bytes (Global Constraints); tests lower them. */
  limits: UploadLimits;
}

export interface UploadLimits {
  /** A catalog file: 4 GiB (D41). */
  upload: number;
  /** One art file: 50 MiB. */
  media: number;
  /** A license evidence file: 20 MiB. */
  evidence: number;
}

export const DEFAULT_LIMITS: UploadLimits = {
  upload: MAX_UPLOAD_BYTES,
  media: 50 * 1024 ** 2,
  evidence: 20 * 1024 ** 2,
};

export function createContext(deps: {
  env: Env;
  db: ApiDb;
  clock: () => Date;
  billing: BillingProvider | null;
  limits?: Partial<UploadLimits>;
  files?: (filesDir: string) => FileStore;
}): ApiContext {
  const { env, db, clock } = deps;
  const newId = () => uuidv7();
  const keys = jwtKeys(env);
  return {
    env,
    db,
    clock,
    newId,
    keys,
    users: new UserRepository(db, newId),
    devices: new DeviceRepository(db, newId),
    tokens: new TokenService({ db, keys, clock, newId }),
    plans: new PlanRepository(db),
    scopes: new ScopeRepository(db),
    subscriptions: new SubscriptionRepository(db),
    billing: deps.billing,
    settings: () => loadAppSettings(db),
    files: deps.files ? deps.files(env.filesDir) : new LocalDiskStore(env.filesDir),
    limits: { ...DEFAULT_LIMITS, ...deps.limits },
  };
}
