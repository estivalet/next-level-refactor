import type { AppSettings } from '@nextlevel/shared';
import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { jwtKeys, type JwtKeys } from './auth/tokens.ts';
import { TokenService } from './auth/TokenService.ts';
import type { ApiDb } from './db/open.ts';
import { plans } from './db/schema.ts';
import type { PlanSummary } from './entitlements/entitlement.ts';
import type { Env } from './env.ts';
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
  settings: () => AppSettings;
  /** The plan every allowed user is on while billing is off (D21). */
  defaultPlan: () => PlanSummary;
}

export function createContext(deps: { env: Env; db: ApiDb; clock: () => Date }): ApiContext {
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
    settings: () => loadAppSettings(db),
    defaultPlan: () => {
      const row = db.select().from(plans).where(eq(plans.slug, 'default')).get();
      if (!row) throw new Error('the Default plan is missing (openDb seeds it)');
      return {
        slug: row.slug,
        name: row.name,
        deviceLimit: row.deviceLimit,
        scopeIds: row.scopeIds,
      };
    },
  };
}
