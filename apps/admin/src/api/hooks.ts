import {
  AdminSubscriptionSchema,
  AdminUserDetailSchema,
  AdminUserSummarySchema,
  AppSettingsViewSchema,
  AuditEntrySchema,
  PageSchema,
  type AdminUserPatch,
  type AppSettingsPatch,
  type GrantRequest,
} from '@nextlevel/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from './client.ts';

const UsersPage = PageSchema(AdminUserSummarySchema);
const AuditPage = PageSchema(AuditEntrySchema);

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  return search ? `?${search}` : '';
};

export function useUsers(filters: { q: string; status: string; access: string; plan: string }) {
  return useInfiniteQuery({
    queryKey: ['users', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiFetch(`/v1/admin/users${query({ ...filters, cursor: pageParam })}`, {
        schema: UsersPage,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () =>
      apiFetch(`/v1/admin/users/${encodeURIComponent(id)}`, { schema: AdminUserDetailSchema }),
  });
}

/** Changes go straight into the detail; lists and the audit log refetch. */
export function usePatchUser(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: AdminUserPatch) =>
      apiFetch(`/v1/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: patch,
        schema: AdminUserDetailSchema,
      }),
    onSuccess: (detail) => {
      client.setQueryData(['user', id], detail);
      void client.invalidateQueries({ queryKey: ['users'] });
      void client.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useRevokeUserDevice(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) =>
      apiFetch(
        `/v1/admin/users/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}`,
        { method: 'DELETE', schema: z.unknown() },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['user', userId] });
      void client.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

/** Complimentary grants (FR-SUB-4): the detail, the lists and the audit log refetch. */
function useGrantWrite<T>(userId: string, call: (input: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['user', userId] });
      void client.invalidateQueries({ queryKey: ['users'] });
      void client.invalidateQueries({ queryKey: ['plans'] });
      void client.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export const useGrant = (userId: string) =>
  useGrantWrite(userId, (body: GrantRequest) =>
    apiFetch(`/v1/admin/users/${encodeURIComponent(userId)}/grants`, {
      method: 'POST',
      body,
      schema: AdminSubscriptionSchema,
    }),
  );

export const useRevokeGrant = (userId: string) =>
  useGrantWrite(userId, (subscriptionId: string) =>
    apiFetch(
      `/v1/admin/users/${encodeURIComponent(userId)}/grants/${encodeURIComponent(subscriptionId)}`,
      { method: 'DELETE', schema: z.unknown() },
    ),
  );

export function useAudit(filters: { actor: string; target: string }) {
  return useInfiniteQuery({
    queryKey: ['audit', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiFetch(
        `/v1/admin/audit${query({ actor: filters.actor, target: filters.target, cursor: pageParam })}`,
        { schema: AuditPage },
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useAppSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch('/v1/admin/settings', { schema: AppSettingsViewSchema }),
  });
}

export function useSaveAppSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: AppSettingsPatch) =>
      apiFetch('/v1/admin/settings', {
        method: 'PATCH',
        body: patch,
        schema: AppSettingsViewSchema,
      }),
    onSuccess: (settings) => {
      client.setQueryData(['settings'], settings);
      void client.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}
