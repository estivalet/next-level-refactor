import type { AdminPlan } from '@nextlevel/shared';
import type { FastifyInstance } from 'fastify';
import { catalogAdmin } from './catalogAdmin.ts';
import { bearer, signIn } from './launcherSignIn.ts';

/**
 * A catalog with published items in two scopes and a signed-in player whose Default plan
 * (billing off) holds `scopes` (M9c route tests).
 */
export async function catalogWorld(app: FastifyInstance) {
  const admin = await catalogAdmin(app);
  const publish = async (
    slug: string,
    opts: {
      systemId?: string;
      scopeSlug?: string;
      filename?: string;
      patch?: Record<string, unknown>;
    } = {},
  ) => {
    const id = await admin.createItem(slug, opts);
    await admin.makePublishable(id, {}, opts.filename);
    if (opts.patch) await admin.send('PATCH', admin.base(id), opts.patch);
    await admin.send('POST', `${admin.base(id)}/publish`);
    return id;
  };
  const scopeIdOf = async (slug: string) =>
    (await admin.send('GET', '/v1/admin/scopes'))
      .json<Array<{ id: string; slug: string }>>()
      .find((scope) => scope.slug === slug)?.id ?? '';
  /** Sets the Default plan's scopes: everyone's plan while billing is off (D21). */
  const planScopes = async (slugs: string[]) => {
    const plans = (await admin.send('GET', '/v1/admin/plans')).json<AdminPlan[]>();
    const plan = plans.find((p) => p.slug === 'default');
    const scopeIds = await Promise.all(slugs.map(scopeIdOf));
    await admin.send('PATCH', `/v1/admin/plans/${plan?.id ?? ''}`, { scopeIds });
  };
  const player = await signIn(app, 'subscriber');
  const get = (url: string, token = player.accessToken) =>
    app.inject({ url, headers: bearer(token) });
  const post = (url: string, payload: object, token = player.accessToken) =>
    app.inject({ method: 'POST', url, headers: bearer(token), payload });
  return { admin, publish, planScopes, player, get, post };
}
