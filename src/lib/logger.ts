import pino from 'pino';

/**
 * Structured logging using Pino
 *
 * Usage:
 * import { logger } from '@/lib/logger';
 *
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Payment failed', { error, userId: '123', amount: 100 });
 * logger.warn('Rate limit approaching', { ip: '127.0.0.1', remaining: 5 });
 */

// Determine log level based on environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// PERF-009: Create async destination for production to avoid blocking I/O
const destination = process.env.NODE_ENV === 'production'
  ? pino.destination({
      dest: 1, // stdout
      sync: false, // Async writes to avoid blocking
      minLength: 4096, // Buffer size before flush
    })
  : undefined;

const observabilityWebhookUrl = process.env.OBSERVABILITY_WEBHOOK_URL?.trim() || '';

/**
 * Pino redact paths.
 *
 * Exported so tests can verify the redact list without intercepting Pino's
 * internal write stream. Update this list (not an inline literal) when adding
 * new sensitive fields.
 *
 * Notes on what is and isn't redacted:
 * - Financial PII (bankReference, amount, priceQ, creditor, balance) is
 *   redacted because it ships to OBSERVABILITY_WEBHOOK_URL (SIEM/Datadog) and
 *   any Sentry transport configured downstream.
 * - Personal identifiers (phone, phoneE164, displayName, address) are redacted
 *   for the same reason.
 * - Correlation IDs (tenantId, userId, requestId) are intentionally NOT
 *   redacted — they're needed to trace events across log destinations.
 */
export const LOGGER_REDACT_PATHS: string[] = [
  // Auth / secrets
  'password',
  'token',
  'authorization',
  'apiKey',
  'api_key',
  'secret',
  'credit_card',
  'ssn',
  'email', // Redact in production logs
  '*.password',
  '*.token',
  '*.authorization',
  '*.apiKey',
  '*.api_key',
  '*.secret',
  '*.email',
  // Financial PII (audit hallazgo I-4)
  'bankReference',
  '*.bankReference',
  'amount',
  '*.amount',
  'priceQ',
  '*.priceQ',
  'creditor',
  '*.creditor',
  'balance',
  '*.balance',
  // Contact / profile PII
  'phone',
  '*.phone',
  'phoneE164',
  '*.phoneE164',
  'displayName',
  '*.displayName',
  'address',
  '*.address',
  // Specific metadata paths (audit logs, webhooks)
  'metadata.email',
  'metadata.bankReference',
  'metadata.amount',
  'metadata.referenceCode',
];

function emitObservability(level: 'warn' | 'error', payload: Record<string, unknown>) {
  if (!observabilityWebhookUrl) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    void fetch(observabilityWebhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        app: 'rutacero',
        env: process.env.NODE_ENV,
        ...payload,
      }),
      signal: controller.signal,
    })
      .catch(() => undefined)
      .finally(() => clearTimeout(timeout));
  } catch {
    // Never break app flow for observability side effects.
  }
}

// Create base logger with appropriate configuration
export const logger = pino({
  level: logLevel,
  // Pretty print in development, async transport in production
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        }
      : undefined,
  // Base context
  base: {
    env: process.env.NODE_ENV,
    app: 'rutacero',
  },
  // Redact sensitive fields
  redact: {
    paths: LOGGER_REDACT_PATHS,
    censor: '[REDACTED]',
  },
  // Timestamp
  timestamp: pino.stdTimeFunctions.isoTime,
// PERF-009: Use async destination in production
}, destination);

/**
 * Create a child logger with additional context
 *
 * @example
 * const userLogger = createChildLogger({ userId: '123' });
 * userLogger.info('Action performed');
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log API request
 */
export function logApiRequest(params: {
  method: string;
  path: string;
  userId?: string;
  ip?: string;
  duration?: number;
  statusCode?: number;
}) {
  logger.info(
    {
      type: 'api_request',
      ...params,
    },
    `${params.method} ${params.path} ${params.statusCode || ''}`
  );
}

/**
 * Log API error
 */
export function logApiError(params: {
  method: string;
  path: string;
  error: Error | unknown;
  userId?: string;
  statusCode?: number;
}) {
  const errorObj = params.error instanceof Error ? params.error : new Error(String(params.error));

  logger.error(
    {
      type: 'api_error',
      method: params.method,
      path: params.path,
      userId: params.userId,
      statusCode: params.statusCode,
      error: {
        message: errorObj.message,
        stack: errorObj.stack,
        name: errorObj.name,
      },
    },
    `API Error: ${params.method} ${params.path} - ${errorObj.message}`
  );

  emitObservability('error', {
    type: 'api_error',
    method: params.method,
    path: params.path,
    userId: params.userId,
    statusCode: params.statusCode,
    error: errorObj.message,
  });
}

/**
 * Log database operation
 */
export function logDatabaseOperation(params: {
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  table: string;
  userId?: string;
  duration?: number;
  error?: Error;
}) {
  if (params.error) {
    logger.error(
      {
        type: 'db_error',
        ...params,
        error: {
          message: params.error.message,
          stack: params.error.stack,
        },
      },
      `DB Error: ${params.operation} on ${params.table} - ${params.error.message}`
    );
  } else {
    logger.debug(
      {
        type: 'db_operation',
        operation: params.operation,
        table: params.table,
        userId: params.userId,
        duration: params.duration,
      },
      `DB: ${params.operation} on ${params.table}`
    );
  }
}

/**
 * Log payment event
 */
export function logPaymentEvent(params: {
  event: 'checkout_created' | 'payment_succeeded' | 'payment_failed' | 'subscription_created' | 'subscription_canceled';
  userId?: string;
  amount?: number;
  currency?: string;
  provider?: string;
  externalId?: string;
  error?: Error;
}) {
  const level = params.error ? 'error' : 'info';

  logger[level](
    {
      type: 'payment_event',
      ...params,
      error: params.error
        ? {
            message: params.error.message,
            stack: params.error.stack,
          }
        : undefined,
    },
    `Payment: ${params.event} ${params.error ? `- ${params.error.message}` : ''}`
  );
}

/**
 * Log email event
 */
export function logEmailEvent(params: {
  event: 'sent' | 'failed' | 'queued';
  to: string;
  template: string;
  userId?: string;
  error?: Error;
}) {
  const level = params.error ? 'error' : 'info';

  logger[level](
    {
      type: 'email_event',
      event: params.event,
      // Partially redact email for privacy
      to: params.to.replace(/(.{2}).*(@.*)/, '$1***$2'),
      template: params.template,
      userId: params.userId,
      error: params.error
        ? {
            message: params.error.message,
            stack: params.error.stack,
          }
        : undefined,
    },
    `Email: ${params.template} ${params.event} to ${params.to.replace(/(.{2}).*(@.*)/, '$1***$2')}`
  );
}

/**
 * Log webhook event
 */
export function logWebhookEvent(params: {
  provider: string;
  event: string;
  eventId?: string;
  processed: boolean;
  error?: Error;
}) {
  const level = params.error ? 'error' : 'info';

  logger[level](
    {
      type: 'webhook_event',
      ...params,
      error: params.error
        ? {
            message: params.error.message,
            stack: params.error.stack,
          }
        : undefined,
    },
    `Webhook: ${params.provider} ${params.event} - ${params.processed ? 'processed' : 'failed'}`
  );

  if (params.error) {
    emitObservability('error', {
      type: 'webhook_event',
      provider: params.provider,
      event: params.event,
      eventId: params.eventId,
      processed: params.processed,
      error: params.error.message,
    });
  }
}

/**
 * Log security event
 */
export function logSecurityEvent(params: {
  event: 'rate_limit_exceeded' | 'unauthorized_access' | 'invalid_token' | 'suspicious_activity' |
        'cron_secret_not_configured' | 'invalid_cron_secret' | 'cron_access_from_invalid_ip' |
        'webhook_secret_not_configured' | 'admin_jwt_secret_not_configured' |
        'invalid_webhook_signature' | 'audit_log_failed' | 'invalid_admin_session_token';
  userId?: string;
  ip?: string;
  path?: string;
  details?: Record<string, unknown>;
}) {
  logger.warn(
    {
      type: 'security_event',
      ...params,
    },
    `Security: ${params.event}`
  );

  emitObservability('warn', {
    type: 'security_event',
    event: params.event,
    userId: params.userId,
    ip: params.ip,
    path: params.path,
    details: params.details,
  });
}

/**
 * Log cron job execution
 */
export function logCronEvent(params: {
  job: string;
  status: 'started' | 'completed' | 'failed';
  duration?: number;
  processed?: number;
  error?: Error;
}) {
  const level = params.status === 'failed' ? 'error' : 'info';

  logger[level](
    {
      type: 'cron_job',
      ...params,
      error: params.error
        ? {
            message: params.error.message,
            stack: params.error.stack,
          }
        : undefined,
    },
    `Cron: ${params.job} ${params.status}${params.processed ? ` (${params.processed} items)` : ''}`
  );

  if (params.status === 'failed') {
    emitObservability('error', {
      type: 'cron_job',
      job: params.job,
      status: params.status,
      duration: params.duration,
      error: params.error?.message,
    });
  }
}

/**
 * Log engine calculation
 */
export function logEngineCalculation(params: {
  engine: 'payoff' | 'forecast' | 'risk';
  userId: string;
  duration?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: Error;
}) {
  const level = params.error ? 'error' : 'debug';

  logger[level](
    {
      type: 'engine_calculation',
      ...params,
      error: params.error
        ? {
            message: params.error.message,
            stack: params.error.stack,
          }
        : undefined,
    },
    `Engine: ${params.engine} calculation ${params.error ? 'failed' : 'completed'}${params.duration ? ` in ${params.duration}ms` : ''}`
  );
}

// Export for convenience
export default logger;
