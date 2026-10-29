import { AppErrorException, ERROR_CODES } from '@nextlevel/shared';
import type { ZodType } from 'zod';
import { csrfToken, failure } from '../../api/client.ts';

/**
 * PUTs a file's bytes to the API (catalog files, art, license evidence; D41) with
 * XMLHttpRequest, because only XHR reports upload progress. Same session and CSRF header as
 * `apiFetch`; a refusal is the envelope's AppErrorException, a lost connection API_UNREACHABLE.
 */
export function putBlob<T>(
  url: string,
  body: Blob,
  opts: {
    contentType: string;
    schema: ZodType<T>;
    onProgress?: (loaded: number, total: number) => void;
  },
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', opts.contentType);
    const csrf = csrfToken();
    if (csrf) xhr.setRequestHeader('x-csrf-token', csrf);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) opts.onProgress?.(event.loaded, event.total);
    };
    xhr.onload = () => {
      let json: unknown;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        json = undefined;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(failure(xhr.status, json, true));
        return;
      }
      const parsed = opts.schema.safeParse(json);
      if (parsed.success) resolve(parsed.data);
      else reject(new AppErrorException({ code: 'INTERNAL', message: ERROR_CODES.INTERNAL }));
    };
    xhr.onerror = () => {
      reject(
        new AppErrorException({ code: 'API_UNREACHABLE', message: ERROR_CODES.API_UNREACHABLE }),
      );
    };
    xhr.send(body);
  });
}
