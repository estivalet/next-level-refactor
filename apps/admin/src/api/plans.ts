import {
  AdminPlanSchema,
  CatalogScopeSchema,
  type AdminPlan,
  type AdminPlanCreate,
  type AdminPlanPatch,
  type CatalogScopeCreate,
  type CatalogScopePatch,
} from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from './client.ts';

// Plans and catalog scopes (S13, FR-ADM-2, US-F4). Every write refreshes the lists and the audit.

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => apiFetch('/v1/admin/plans', { schema: z.array(AdminPlanSchema) }),
  });
}

export function useScopes() {
  return useQuery({
    queryKey: ['scopes'],
    queryFn: () => apiFetch('/v1/admin/scopes', { schema: z.array(CatalogScopeSchema) }),
  });
}

function useWrite<TInput, TOutput>(call: (input: TInput) => Promise<TOutput>, key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [key] });
      void client.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

/** The new plan goes into the list at once: its editor opens before the refetch lands. */
export function useCreatePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminPlanCreate) =>
      apiFetch('/v1/admin/plans', { method: 'POST', body, schema: AdminPlanSchema }),
    onSuccess: (plan) => {
      client.setQueryData<AdminPlan[]>(['plans'], (list) => [...(list ?? []), plan]);
      void client.invalidateQueries({ queryKey: ['plans'] });
      void client.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

/** The saved plan goes straight into the list, so the editor starts from it at once. */
export function useUpdatePlan(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminPlanPatch) =>
      apiFetch(`/v1/admin/plans/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body,
        schema: AdminPlanSchema,
      }),
    onSuccess: (plan) => {
      client.setQueryData<AdminPlan[]>(['plans'], (list) =>
        list?.map((item) => (item.id === plan.id ? plan : item)),
      );
      void client.invalidateQueries({ queryKey: ['plans'] });
      void client.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export const useCreateScope = () =>
  useWrite(
    (body: CatalogScopeCreate) =>
      apiFetch('/v1/admin/scopes', { method: 'POST', body, schema: CatalogScopeSchema }),
    'scopes',
  );

export const useUpdateScope = (id: string) =>
  useWrite(
    (body: CatalogScopePatch) =>
      apiFetch(`/v1/admin/scopes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body,
        schema: CatalogScopeSchema,
      }),
    'scopes',
  );
