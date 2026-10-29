import {
  AdminCatalogFileSchema,
  AdminCatalogItemSchema,
  AdminCatalogMediaSchema,
  AdminCatalogPageSchema,
  StartUploadResponseSchema,
  UploadResultSchema,
  type AdminCatalogItem,
  type CatalogMediaKind,
  type CreateItem,
  type FileRole,
  type LicenseInput,
  type UpdateItem,
} from '@nextlevel/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { putBlob } from '../pages/catalog/upload.ts';
import { apiFetch } from './client.ts';

// Catalog items for the console (S13, FR-ADM-3, US-F1). Every write refreshes the item, the list
// and the audit log; a write that answers with the item puts it in place at once.

export const itemPath = (id: string) => `/v1/admin/catalog/items/${encodeURIComponent(id)}`;
const itemKey = (id: string) => ['catalogItem', id];

export function useCatalogItems(filters: { q: string; status: string; scope: string }) {
  return useInfiniteQuery({
    queryKey: ['catalog', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const search = new URLSearchParams(
        Object.entries({ ...filters, cursor: pageParam }).filter(
          (entry): entry is [string, string] => Boolean(entry[1]),
        ),
      ).toString();
      return apiFetch(`/v1/admin/catalog/items${search ? `?${search}` : ''}`, {
        schema: AdminCatalogPageSchema,
      });
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useCatalogItem(id: string) {
  return useQuery({
    queryKey: itemKey(id),
    queryFn: () => apiFetch(itemPath(id), { schema: AdminCatalogItemSchema }),
  });
}

export function useCreateItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateItem) =>
      apiFetch('/v1/admin/catalog/items', { method: 'POST', body, schema: AdminCatalogItemSchema }),
    onSuccess: (created) => {
      client.setQueryData(itemKey(created.id), created);
      void client.invalidateQueries({ queryKey: ['catalog'] });
      void client.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

/** Uploads carry this key, so the editor knows one is running (leave warning). */
export const uploadKey = (id: string) => ['upload', id];

function useItemWrite<TInput, TOutput>(
  id: string,
  call: (input: TInput) => Promise<TOutput>,
  mutationKey?: readonly unknown[],
) {
  const client = useQueryClient();
  return useMutation({
    ...(mutationKey ? { mutationKey } : {}),
    mutationFn: call,
    onSuccess: (result) => {
      const parsed = AdminCatalogItemSchema.safeParse(result);
      if (parsed.success) client.setQueryData<AdminCatalogItem>(itemKey(id), parsed.data);
      void client.invalidateQueries({ queryKey: itemKey(id) });
      void client.invalidateQueries({ queryKey: ['catalog'] });
      void client.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

const write = (method: 'POST' | 'PUT' | 'PATCH', path: string) => (body?: unknown) =>
  apiFetch(path, { method, body, schema: AdminCatalogItemSchema });

export const useUpdateItem = (id: string) =>
  useItemWrite(id, (patch: UpdateItem) => write('PATCH', itemPath(id))(patch));

export const usePublish = (id: string) =>
  useItemWrite(id, () => write('POST', `${itemPath(id)}/publish`)());

export const useUnpublish = (id: string) =>
  useItemWrite(id, () => write('POST', `${itemPath(id)}/unpublish`)());

export const usePutLicense = (id: string) =>
  useItemWrite(id, (license: LicenseInput) => write('PUT', `${itemPath(id)}/license`)(license));

export const useVerifyLicense = (id: string) =>
  useItemWrite(id, () => write('POST', `${itemPath(id)}/license/verify`)());

export const useRemoveFile = (id: string) =>
  useItemWrite(id, (fileId: string) =>
    apiFetch(`${itemPath(id)}/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      schema: z.unknown(),
    }),
  );

export const useRemoveMedia = (id: string) =>
  useItemWrite(id, (kind: CatalogMediaKind) =>
    apiFetch(`${itemPath(id)}/media/${kind}`, { method: 'DELETE', schema: z.unknown() }),
  );

type Progress = (loaded: number, total: number) => void;

/**
 * A game file (D41): start it, PUT the bytes (the API computes size and SHA-256), then complete
 * it. A ready file with the same name is replaced by the API.
 */
export const useUploadFile = (id: string) =>
  useItemWrite(
    id,
    async (input: { file: Blob; filename: string; role: FileRole; onProgress: Progress }) => {
      const started = await apiFetch(`${itemPath(id)}/files`, {
        method: 'POST',
        body: { filename: input.filename, role: input.role },
        schema: StartUploadResponseSchema,
      });
      const uploaded = await putBlob(started.uploadUrl, input.file, {
        contentType: 'application/octet-stream',
        schema: UploadResultSchema,
        onProgress: input.onProgress,
      });
      const file = await apiFetch(
        `${itemPath(id)}/files/${encodeURIComponent(started.fileId)}/complete`,
        { method: 'POST', body: {}, schema: AdminCatalogFileSchema },
      );
      return { file, uploaded };
    },
    uploadKey(id),
  );

export const useUploadMedia = (id: string) =>
  useItemWrite(
    id,
    (input: { file: Blob; kind: CatalogMediaKind; onProgress: Progress }) =>
      putBlob(`${itemPath(id)}/media/${input.kind}`, input.file, {
        contentType: input.file.type || 'application/octet-stream',
        schema: AdminCatalogMediaSchema,
        onProgress: input.onProgress,
      }),
    uploadKey(id),
  );

const EVIDENCE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain',
  eml: 'message/rfc822',
};

/**
 * The evidence's type: the browser's, or from its extension (Windows gives none for .eml). An
 * unknown one goes as octet-stream, which the API refuses with a reason the tab explains.
 */
export const evidenceType = (file: File) =>
  file.type ||
  EVIDENCE_TYPES[file.name.split('.').pop()?.toLowerCase() ?? ''] ||
  'application/octet-stream';

export const useUploadEvidence = (id: string) =>
  useItemWrite(
    id,
    (input: { file: File; onProgress: Progress }) =>
      putBlob(
        `${itemPath(id)}/license/evidence?filename=${encodeURIComponent(input.file.name)}`,
        input.file,
        {
          contentType: evidenceType(input.file),
          schema: AdminCatalogItemSchema,
          onProgress: input.onProgress,
        },
      ),
    uploadKey(id),
  );
