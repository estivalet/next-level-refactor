import { QueryClient } from '@tanstack/react-query';

/** IPC state lives in TanStack Query; failures surface as query errors, never retried blindly. */
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
