import { z } from 'zod';
import { ERROR_CODES, type ErrorCode } from '../errors.ts';

const codes = Object.keys(ERROR_CODES) as [ErrorCode, ...ErrorCode[]];

/** Every API error response (api-spec §1): a stable code, an English message, the request id. */
export const ApiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum(codes),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorEnvelope = z.output<typeof ApiErrorEnvelopeSchema>;
