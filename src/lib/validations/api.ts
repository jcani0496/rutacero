import { z } from 'zod';

/**
 * Validation schemas for API endpoints
 *
 * Usage:
 * import { webhookEventSchema } from '@/lib/validations/api';
 *
 * const validated = webhookEventSchema.parse(data);
 */

// Common schemas
export const uuidSchema = z.string().uuid('ID inválido');

export const emailSchema = z.string().email('Email inválido');

export const currencySchema = z.enum(['GTQ', 'USD'], {
  message: 'Moneda debe ser GTQ o USD',
});

export const positiveNumberSchema = z.number().positive('Debe ser un número positivo');

export const nonNegativeNumberSchema = z.number().nonnegative('No puede ser negativo');
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

// Recurrente Webhook Event Schema
// VUL-007: Strict metadata validation to prevent injection attacks
export const recurrenteMetadataSchema = z.object({
  tenant_id: z.string().uuid().optional(),
  purchaser_user_id: z.string().uuid().optional(),
  plan_code: z.enum(['FREE', 'PRO', 'BUSINESS']).optional(),
  plan_strategy: z.enum(['AVALANCHE', 'SNOWBALL', 'HYBRID']).optional(),
  attribution_id: z.string().max(120).optional(),
  source: z.string().max(120).optional(),
  medium: z.string().max(120).optional(),
  campaign_id: z.string().max(120).optional(),
  campaign_name: z.string().max(120).optional(),
  creative_id: z.string().max(120).optional(),
  creative_name: z.string().max(120).optional(),
  partner_slug: z.string().max(120).optional(),
  referral_code: z.string().max(120).optional(),
  landing_variant: z.string().max(120).optional(),
  offer_variant: z.string().max(120).optional(),
  cta_context: z.string().max(120).optional(),
  path: z.string().max(240).optional(),
  first_touch_json: z.string().max(4000).optional(),
  last_touch_json: z.string().max(4000).optional(),
  variant_code: z.enum(['PRO_MONTHLY', 'PRO_QUARTERLY', 'PRO_ANNUAL', 'PRO_PASS_90D']).optional(),
  one_time: z.string().max(8).optional(),
}).strict(); // Reject unknown fields (VUL-007 remediation)

// Schema for payment success/subscription events (user_id required)
export const paymentMetadataSchema = z.object({
  tenant_id: z.string().uuid('tenant_id debe ser un UUID válido'),
  purchaser_user_id: z.string().uuid('purchaser_user_id debe ser un UUID válido'),
  plan_code: z.enum(['FREE', 'PRO', 'BUSINESS']).default('PRO'),
  plan_strategy: z.enum(['AVALANCHE', 'SNOWBALL', 'HYBRID']).optional(),
  attribution_id: z.string().max(120).optional(),
  source: z.string().max(120).optional(),
  medium: z.string().max(120).optional(),
  campaign_id: z.string().max(120).optional(),
  campaign_name: z.string().max(120).optional(),
  creative_id: z.string().max(120).optional(),
  creative_name: z.string().max(120).optional(),
  partner_slug: z.string().max(120).optional(),
  referral_code: z.string().max(120).optional(),
  landing_variant: z.string().max(120).optional(),
  offer_variant: z.string().max(120).optional(),
  cta_context: z.string().max(120).optional(),
  path: z.string().max(240).optional(),
  first_touch_json: z.string().max(4000).optional(),
  last_touch_json: z.string().max(4000).optional(),
  variant_code: z.enum(['PRO_MONTHLY', 'PRO_QUARTERLY', 'PRO_ANNUAL', 'PRO_PASS_90D']).optional(),
  one_time: z.string().max(8).optional(),
}).strict();

export const recurrenteWebhookDataSchema = z.object({
  id: z.string(),
  subscription_id: z.string().optional(),
  metadata: recurrenteMetadataSchema.optional(),
}).passthrough();

export const recurrenteWebhookEventSchema = z.object({
  id: z.string(),
  type: z.enum([
    'checkout.completed',
    'payment_intent.succeeded',
    'payment_intent.failed',
    'subscription.created',
    'subscription.canceled',
    'subscription.cancelled', // Handle both spellings
  ]),
  data: recurrenteWebhookDataSchema,
  created_at: z.string().optional(),
}).passthrough();

// Checkout Creation Schema
export const createCheckoutSchema = z.object({
  plan_code: z.enum(['PRO', 'BUSINESS']).default('PRO'),
});

// Cancel Subscription Schema (no body required)
export const cancelSubscriptionSchema = z.object({});

// Cron Job Response Schema (for validation)
export const cronJobResponseSchema = z.object({
  sent: z.number().optional(),
  failed: z.number().optional(),
  total: z.number().optional(),
});

// Payment Reminder Result
export const paymentReminderResultSchema = z.object({
  sent: z.number().default(0),
  failed: z.number().default(0),
  errors: z.array(z.string()).optional(),
});

// Debt schemas for validation
export const debtTypeSchema = z.enum(['CREDIT_CARD', 'LOAN', 'INSTALLMENT', 'INFORMAL']);

export const debtStatusSchema = z.enum(['ACTIVE', 'PAID_OFF', 'RESTRUCTURED', 'DEFAULTED']);

export const debtInterestModelSchema = z.enum(['MONTHLY_SIMPLE', 'DAILY_SIMPLE', 'DAILY_AVG_BALANCE']);

export const debtMinPaymentRuleSchema = z.union([
  z.object({
    type: z.literal('FIXED'),
    amount: positiveNumberSchema,
  }).strict(),
  z.object({
    type: z.literal('PERCENT_OF_BALANCE'),
    percent: z.number().min(0).max(1),
    minimum: positiveNumberSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('PERCENT_PLUS_INTEREST_FEES'),
    percent: z.number().min(0).max(1),
    minimum: positiveNumberSchema.optional(),
  }).strict(),
]);

export const createDebtSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(100, 'Nombre muy largo'),
  type: debtTypeSchema,
  balance: positiveNumberSchema,
  original_amount: positiveNumberSchema.optional(),
  apr: nonNegativeNumberSchema.max(100, 'APR no puede exceder 100%'),
  minimum_payment: positiveNumberSchema,
  due_day: z.number().int().min(1).max(31),
  payment_day: z.number().int().min(1).max(31).optional(),
  interest_model: debtInterestModelSchema.optional(),
  monthly_fees: nonNegativeNumberSchema.optional(),
  min_payment_rule: debtMinPaymentRuleSchema.optional(),
  currency: currencySchema,
  category: z.string().max(50).optional(),
  creditor: z.string().max(100).optional(),
  account_last_four: z.string().length(4).optional(),
  status: debtStatusSchema.default('ACTIVE'),
  notes: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  goal_extra_payment: nonNegativeNumberSchema.optional(),
  goal_target_date: dateOnlySchema.optional(),
});

export const updateDebtSchema = createDebtSchema.partial();

// Payment schemas
export const createPaymentSchema = z.object({
  debt_id: uuidSchema,
  amount: positiveNumberSchema,
  payment_date: z.string().datetime('Fecha inválida'),
  payment_method: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  is_extra: z.boolean().default(false),
});

// Income schemas
export const incomeFrequencySchema = z.enum(['MONTHLY', 'BIWEEKLY', 'WEEKLY', 'ONCE']);

export const createIncomeSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(100),
  amount: positiveNumberSchema,
  frequency: incomeFrequencySchema,
  currency: currencySchema,
  next_date: z.string().datetime('Fecha inválida'),
  is_variable: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

export const updateIncomeSchema = createIncomeSchema.partial();

// Essential Expense schemas
export const createEssentialExpenseSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(100),
  amount: positiveNumberSchema,
  frequency: incomeFrequencySchema,
  currency: currencySchema,
  due_day: z.number().int().min(1).max(31).optional(),
  category: z.string().max(50).optional(),
  is_variable: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

export const updateEssentialExpenseSchema = createEssentialExpenseSchema.partial();

// Plan Strategy schema
export const planStrategySchema = z.enum(['AVALANCHE', 'SNOWBALL', 'HYBRID']);

export const generatePlanSchema = z.object({
  strategy: planStrategySchema.default('AVALANCHE'),
  monthly_budget: positiveNumberSchema.optional(),
  extra_payment: nonNegativeNumberSchema.optional(),
});

// Budget Category schema
export const budgetCategorySchema = z.string().min(1, 'Categoria requerida').max(100);

export const createBudgetTargetSchema = z.object({
  category: budgetCategorySchema,
  amount: positiveNumberSchema.optional(),
  monthly_target: positiveNumberSchema.optional(),
  period: z.enum(['MONTHLY', 'BIWEEKLY']).default('MONTHLY'),
  currency: currencySchema,
  actual_amount: nonNegativeNumberSchema.optional(),
}).refine((data) => data.amount ?? data.monthly_target, {
  message: 'Monto es requerido',
  path: ['amount'],
});

export const updateBudgetTargetSchema = z.object({
  category: budgetCategorySchema.optional(),
  amount: positiveNumberSchema.optional(),
  monthly_target: positiveNumberSchema.optional(),
  period: z.enum(['MONTHLY', 'BIWEEKLY']).optional(),
  currency: currencySchema.optional(),
  actual_amount: nonNegativeNumberSchema.optional(),
});

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const dateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export const debtFilterSchema = paginationSchema.extend({
  status: debtStatusSchema.optional(),
  type: debtTypeSchema.optional(),
  currency: currencySchema.optional(),
  sort_by: z.enum(['balance', 'apr', 'name', 'due_day']).optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const paymentFilterSchema = paginationSchema.extend({
  debt_id: uuidSchema.optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

// Helper function to validate request body
export async function validateRequestBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.issues);
    }
    throw error;
  }
}

// Helper function to validate query parameters
export function validateQueryParams<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  const params = Object.fromEntries(searchParams.entries());
  return schema.parse(params);
}

// Custom validation error
export class ValidationError extends Error {
  public errors: z.ZodIssue[];

  constructor(errors: z.ZodIssue[]) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }

  toJSON() {
    return {
      error: 'Validation failed',
      issues: this.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };
  }
}

// Error response helper
export function validationErrorResponse(error: ValidationError) {
  return new Response(JSON.stringify(error.toJSON()), {
    status: 400,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
