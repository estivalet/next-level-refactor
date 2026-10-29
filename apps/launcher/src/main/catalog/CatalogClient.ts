import {
  AppErrorException,
  CatalogItemSchema,
  CatalogPageSchema,
  DownloadGrantSchema,
  ERROR_CODES,
  InstallStatusSchema,
  type CatalogItem,
  type CatalogPage,
  type CatalogQuery,
  type DownloadGrant,
  type InstallStatus,
  type InstallStatusRequest,
} from '@nextlevel/shared';
import type { ApiClient } from '../auth/ApiClient.ts';

/** What the catalog needs from the signed-in session (AuthService). */
export interface CatalogSession {
  accessCall<T>(call: (token: string) => Promise<T>): Promise<T>;
  deviceId(): string | null;
}

const path = (itemId: string) => `/v1/catalog/items/${encodeURIComponent(itemId)}`;

/**
 * The subscriber catalog API (api-spec Catalog, FR-CAT-1..7) through the signed-in session:
 * API errors arrive as AppErrorExceptions, no network as API_UNREACHABLE.
 */
export class CatalogClient {
  constructor(
    private readonly api: Pick<ApiClient, 'request'>,
    private readonly session: CatalogSession,
  ) {}

  list(query: Partial<CatalogQuery>): Promise<CatalogPage> {
    const search = new URLSearchParams(
      Object.entries(query)
        .filter((entry) => entry[1] !== undefined && entry[1] !== '')
        .map(([key, value]): [string, string] => [key, String(value)]),
    ).toString();
    return this.session.accessCall((access) =>
      this.api.request('GET', `/v1/catalog/items${search ? `?${search}` : ''}`, CatalogPageSchema, {
        access,
      }),
    );
  }

  get(itemId: string): Promise<CatalogItem> {
    return this.session.accessCall((access) =>
      this.api.request('GET', path(itemId), CatalogItemSchema, { access }),
    );
  }

  /** Signed URLs for every file of the item, for this PC (10 minutes each). */
  downloads(itemId: string): Promise<DownloadGrant> {
    const deviceId = this.session.deviceId();
    if (!deviceId) {
      return Promise.reject(
        new AppErrorException({ code: 'API_UNREACHABLE', message: ERROR_CODES.API_UNREACHABLE }),
      );
    }
    return this.session.accessCall((access) =>
      this.api.request('POST', `${path(itemId)}/downloads`, DownloadGrantSchema, {
        access,
        body: { deviceId },
      }),
    );
  }

  status(body: InstallStatusRequest): Promise<InstallStatus> {
    return this.session.accessCall((access) =>
      this.api.request('POST', '/v1/catalog/status', InstallStatusSchema, { access, body }),
    );
  }
}
