import { UserProfileSchema } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import { apiFetch, onUnauthenticated } from './client.ts';

const SESSION_KEY = ['session'] as const;
const SessionSchema = z.object({ user: UserProfileSchema, csrf: z.string() });

/** The signed-in admin, or an error (no session) → the sign-in page. */
export function useSession() {
  const client = useQueryClient();
  useEffect(
    () =>
      onUnauthenticated(() => {
        client.setQueryData(SESSION_KEY, null);
      }),
    [client],
  );
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => apiFetch('/v1/auth/session', { schema: SessionSchema }).catch(() => null),
    retry: false,
  });
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/v1/auth/session/logout', { method: 'POST', schema: z.unknown() }),
    onSettled: () => {
      client.clear();
      client.setQueryData(SESSION_KEY, null);
    },
  });
}
