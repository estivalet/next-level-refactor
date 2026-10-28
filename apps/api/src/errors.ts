import type { ApiErrorEnvelope, ErrorCode } from '@nextlevel/shared';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import helmet from 'helmet';

// One error envelope for every failure (api-spec §1). Messages are English defaults; clients
// show their own translation of the code.

const STATUS: Partial<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  SUBSCRIPTION_REQUIRED: 403,
  SUSPENDED: 403,
  NOT_ALLOWED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DEVICE_LIMIT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  BILLING_UNAVAILABLE: 503,
};

export const MESSAGES: Partial<Record<ErrorCode, string>> = {
  VALIDATION_FAILED: 'The request was not valid.',
  UNAUTHENTICATED: 'Sign in again.',
  FORBIDDEN: 'Not allowed.',
  SUBSCRIPTION_REQUIRED: 'An active subscription is required.',
  SUSPENDED: 'This account is suspended.',
  NOT_ALLOWED: "This Google account isn't authorized.",
  NOT_FOUND: 'Not found.',
  CONFLICT: 'The change conflicts with the current state.',
  DEVICE_LIMIT: 'Device limit reached.',
  RATE_LIMITED: 'Too many requests.',
  INTERNAL: 'Something went wrong.',
  BILLING_UNAVAILABLE: 'Billing is unavailable right now.',
};

/** An expected failure a route throws; the error handler turns it into the envelope. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;
  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? MESSAGES[code] ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS[code] ?? 400;
    this.details = details;
  }
}

export function apiError(code: ErrorCode, message?: string, details?: unknown): ApiError {
  return new ApiError(code, message, details);
}

function envelope(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: unknown,
): ApiErrorEnvelope {
  return { error: { code, message, requestId, ...(details === undefined ? {} : { details }) } };
}

/** Drizzle's query errors end with the bound values ("params: …"): emails, token hashes. */
const redact = (text: string | undefined) =>
  text?.replace(/params:[\s\S]*?(?=\n\s+at |$)/g, 'params: [redacted]');

/** An unexpected error as it may be logged (architecture §7: no PII beyond the user id). */
function loggable(error: Error): Record<string, unknown> {
  const cause = error.cause instanceof Error ? error.cause.name : undefined;
  return { type: error.name, message: redact(error.message), stack: redact(error.stack), cause };
}

/** Helmet's headers, for replies that skip the hooks @fastify/helmet sets them in. */
const securityHeaders = helmet();

/**
 * Fastify's router refuses some requests before any hook runs (a malformed `%` escape (400), a
 * parameter over `maxParamLength` (414)): those get the envelope, keep their status, are logged
 * and still carry helmet's headers. Passed as the `frameworkErrors` option.
 */
export function frameworkErrors(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const status = error.statusCode === 414 ? 414 : 400;
  request.log.warn({ code: error.code, status }, 'router refused');
  securityHeaders(request.raw, reply.raw, () => {
    void reply
      .status(status)
      .header('x-request-id', request.id)
      .send(envelope('VALIDATION_FAILED', MESSAGES.VALIDATION_FAILED ?? '', request.id));
  });
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ApiError) {
      // RATE_LIMITED from a route's own limit says when to try again (in seconds).
      const retryAfter = (error.details as { retryAfter?: unknown } | undefined)?.retryAfter;
      if (error.code === 'RATE_LIMITED' && typeof retryAfter === 'number') {
        void reply.header('retry-after', String(retryAfter));
      }
      return reply
        .status(error.status)
        .send(envelope(error.code, error.message, request.id, error.details));
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send(
        envelope('VALIDATION_FAILED', MESSAGES.VALIDATION_FAILED ?? '', request.id, {
          issues: error.validation,
        }),
      );
    }
    if (error.statusCode === 429) {
      return reply
        .status(429)
        .send(envelope('RATE_LIMITED', MESSAGES.RATE_LIMITED ?? '', request.id));
    }
    // Fastify's own client errors: malformed JSON, wrong content type, body too large.
    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      return reply
        .status(error.statusCode)
        .send(envelope('VALIDATION_FAILED', MESSAGES.VALIDATION_FAILED ?? '', request.id));
    }
    request.log.error({ err: loggable(error) }, 'unexpected error');
    return reply.status(500).send(envelope('INTERNAL', MESSAGES.INTERNAL ?? '', request.id));
  });
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send(envelope('NOT_FOUND', MESSAGES.NOT_FOUND ?? '', request.id)),
  );
}
