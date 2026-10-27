import { AppErrorException } from '@nextlevel/shared';

// Which plan-editor field a server refusal belongs to (S13, FR-ADM-2), and its message.

export type PlanField = 'slug' | 'priceMonthly' | 'priceYearly' | 'archived';

const PRICE_REASONS = new Set(['interval', 'inactive', 'unknownPrice', 'billingOff', 'priceTaken']);

/**
 * The fields to mark for an error and the i18n key + values of the message. Price refusals go on
 * the price fields that were changed (the API doesn't say which one); `currency` goes on Yearly.
 */
export function fieldErrors(
  error: unknown,
  changed: { priceMonthly: boolean; priceYearly: boolean },
): Partial<Record<PlanField, { key: string; values?: Record<string, string> }>> {
  if (!(error instanceof AppErrorException)) return {};
  const reason = (error.error.details as { reason?: unknown } | undefined)?.reason;
  if (typeof reason !== 'string') return {};
  const message = (values?: Record<string, string>) => ({
    key: `admin.plans.reasons.${reason}`,
    ...(values ? { values } : {}),
  });
  if (reason === 'slugTaken') return { slug: message() };
  if (reason === 'defaultPlan') return { archived: message() };
  if (reason === 'currency') return { priceYearly: message() };
  if (!PRICE_REASONS.has(reason)) return {};
  const both = !changed.priceMonthly && !changed.priceYearly;
  return {
    ...(changed.priceMonthly || both
      ? { priceMonthly: message({ interval: 'admin.plans.intervals.month' }) }
      : {}),
    ...(changed.priceYearly || both
      ? { priceYearly: message({ interval: 'admin.plans.intervals.year' }) }
      : {}),
  };
}
