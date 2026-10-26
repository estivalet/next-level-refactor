import {
  AdminUserDetailSchema,
  AdminUserSummarySchema,
  AppSettingsViewSchema,
  AuditEntrySchema,
  PageSchema,
  type AdminUserPatch,
  type AppSettingsPatch,
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

export function useUsers(filters: { q: string; status: string }) {
  return useInfiniteQuery({
    queryKey: ['users', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiFetch(
        `/v1/admin/users${query({ q: filters.q, status: filters.status, cursor: pageParam })}`,
        { schema: UsersPage },
      ),
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
