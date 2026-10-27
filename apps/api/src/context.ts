import type { AppSettings } from '@nextlevel/shared';
import { v7 as uuidv7 } from 'uuid';
import { jwtKeys, type JwtKeys } from './auth/tokens.ts';
import { TokenService } from './auth/TokenService.ts';
import type { BillingProvider } from './billing/provider.ts';
import type { ApiDb } from './db/open.ts';
import type { PlanSummary } from './entitlements/entitlement.ts';
import type { Env } from './env.ts';
import { PlanRepository, toPlanSummary } from './plans/PlanRepository.ts';
import { ScopeRepository } from './plans/ScopeRepository.ts';
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
  /** Null when no provider is configured (`Env.billing.mode` `none`). */
  billing: BillingProvider | null;
  settings: () => AppSettings;
  /** The plan every allowed user is on while billing is off (D21). */
  defaultPlan: () => PlanSummary;
}

export function createContext(deps: {
  env: Env;
  db: ApiDb;
  clock: () => Date;
  billing: BillingProvider | null;
}): ApiContext {
  const { env, db, clock } = deps;
  const newId = () => uuidv7();
  const keys = jwtKeys(env);
  const planRepo = new PlanRepository(db);
  const scopeRepo = new ScopeRepository(db);
  return {
    env,
    db,
    clock,
    newId,
    keys,
    users: new UserRepository(db, newId),
    devices: new DeviceRepository(db, newId),
    tokens: new TokenService({ db, keys, clock, newId }),
    plans: planRepo,
    scopes: scopeRepo,
    billing: deps.billing,
    settings: () => loadAppSettings(db),
    defaultPlan: () => {
      const row = planRepo.bySlug('default');
      if (!row) throw new Error('the Default plan is missing (openDb seeds it)');
      return toPlanSummary(row, scopeRepo.list());
    },
  };
}
