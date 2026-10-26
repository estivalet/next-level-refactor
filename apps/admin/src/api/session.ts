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
        // Only a live session is re-checked; the check's own 401 must not trigger another.
        if (client.getQueryData(SESSION_KEY)) {
          void client.invalidateQueries({ queryKey: SESSION_KEY });
        }
      }),
    [client],
  );
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () =>
      apiFetch('/v1/auth/session', { schema: SessionSchema, notify: false }).catch(() => null),
    retry: false,
  });
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/v1/auth/session/logout', { method: 'POST', schema: z.unknown() }),
    onSettled: () => {
      // The session query stays (the app watches it); everything else belonged to the admin.
      client.setQueryData(SESSION_KEY, null);
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
    },
  });
}
