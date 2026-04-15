/**
 * OpenAPI 3.0 Specification for RutaCero API
 *
 * This file defines the API documentation for webhooks and public endpoints.
 */

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'RutaCero API',
    version: '1.0.0',
    description:
      'API de gestión de deudas y suscripciones para RutaCero. Incluye webhooks de Recurrente y endpoints de gestión.',
    contact: {
      name: 'RutaCero Support',
      email: 'support@rutacero.com',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  tags: [
    {
      name: 'Webhooks',
      description: 'Endpoints de webhooks para integraciones externas',
    },
    {
      name: 'Payments',
      description: 'Endpoints de gestión de pagos y suscripciones',
    },
    {
      name: 'Cron Jobs',
      description: 'Endpoints para trabajos programados',
    },
  ],
  paths: {
    '/api/webhooks/recurrente': {
      post: {
        tags: ['Webhooks'],
        summary: 'Webhook de Recurrente',
        description:
          'Recibe eventos de pago y suscripción desde Recurrente. Este endpoint es llamado automáticamente por Recurrente cuando ocurren eventos relevantes.',
        operationId: 'recurrenteWebhook',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RecurrenteWebhookEvent',
              },
              examples: {
                checkoutCompleted: {
                  summary: 'Checkout completado',
                  value: {
                    id: 'evt_1234567890',
                    type: 'checkout.completed',
                    data: {
                      id: 'checkout_1234567890',
                      subscription_id: 'sub_1234567890',
                      metadata: {
                        user_id: '550e8400-e29b-41d4-a716-446655440000',
                        plan_code: 'PRO',
                      },
                    },
                    created_at: '2024-01-01T12:00:00Z',
                  },
                },
                paymentSucceeded: {
                  summary: 'Pago exitoso',
                  value: {
                    id: 'evt_9876543210',
                    type: 'payment_intent.succeeded',
                    data: {
                      id: 'pi_9876543210',
                      subscription_id: 'sub_1234567890',
                      metadata: {
                        user_id: '550e8400-e29b-41d4-a716-446655440000',
                        plan_code: 'PRO',
                      },
                    },
                    created_at: '2024-01-01T12:00:00Z',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Webhook procesado exitosamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    received: {
                      type: 'boolean',
                      example: true,
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Error de validación en el payload del webhook',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidationError',
                },
              },
            },
          },
          '429': {
            description: 'Rate limit excedido',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RateLimitError',
                },
              },
            },
          },
          '500': {
            description: 'Error interno del servidor',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/recurrente/create-checkout': {
      post: {
        tags: ['Payments'],
        summary: 'Crear sesión de checkout',
        description:
          'Crea una sesión de checkout en Recurrente para que el usuario pueda suscribirse al plan PRO.',
        operationId: 'createCheckout',
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Checkout creado exitosamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    checkoutUrl: {
                      type: 'string',
                      format: 'uri',
                      example: 'https://checkout.recurrente.com/xyz123',
                    },
                    checkoutId: {
                      type: 'string',
                      example: 'checkout_1234567890',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Usuario ya tiene una suscripción activa',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Usuario no autenticado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limit excedido',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RateLimitError',
                },
              },
            },
          },
          '500': {
            description: 'Error al crear el checkout',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/recurrente/cancel-subscription': {
      post: {
        tags: ['Payments'],
        summary: 'Cancelar suscripción',
        description:
          'Cancela la suscripción activa del usuario. El plan seguirá activo hasta el final del período de facturación.',
        operationId: 'cancelSubscription',
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          '200': {
            description: 'Suscripción cancelada exitosamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    message: {
                      type: 'string',
                      example:
                        'Suscripción cancelada. Tu plan seguirá activo hasta el final del período.',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'No hay suscripción activa para cancelar',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Usuario no autenticado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Suscripción no encontrada',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Error al cancelar la suscripción',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/cron/payment-reminders': {
      get: {
        tags: ['Cron Jobs'],
        summary: 'Procesar recordatorios de pago',
        description:
          'Procesa y envía recordatorios de pago a usuarios con pagos próximos a vencer. Este endpoint debe ser llamado por un cron job programado.',
        operationId: 'processPaymentReminders',
        security: [
          {
            cronSecret: [],
          },
        ],
        responses: {
          '200': {
            description: 'Recordatorios procesados exitosamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    message: {
                      type: 'string',
                      example: 'Payment reminders processed',
                    },
                    sent: {
                      type: 'number',
                      example: 15,
                    },
                    failed: {
                      type: 'number',
                      example: 0,
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      example: '2024-01-01T08:00:00Z',
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - CRON_SECRET inválido',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limit excedido',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RateLimitError',
                },
              },
            },
          },
          '500': {
            description: 'Error al procesar recordatorios',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Cron Jobs'],
        summary: 'Trigger manual de recordatorios',
        description: 'Ejecuta manualmente el procesamiento de recordatorios de pago para testing.',
        operationId: 'triggerPaymentReminders',
        security: [
          {
            cronSecret: [],
          },
        ],
        responses: {
          '200': {
            description: 'Recordatorios procesados exitosamente',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CronJobResponse',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Error al procesar recordatorios',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/cron/lifecycle': {
      get: {
        tags: ['Cron Jobs'],
        summary: 'Procesar la cadencia lifecycle',
        description:
          'Ejecuta los nudges de onboarding, recordatorios de primer plan, resumen semanal, seguimiento de mora y recovery de cobro fallido sobre la infraestructura existente.',
        operationId: 'processLifecycleCadence',
        security: [
          {
            cronSecret: [],
          },
        ],
        responses: {
          '200': {
            description: 'Cadencia lifecycle procesada exitosamente',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CronJobResponse',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limit excedido',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RateLimitError',
                },
              },
            },
          },
          '500': {
            description: 'Error al procesar la cadencia lifecycle',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Cron Jobs'],
        summary: 'Trigger manual de la cadencia lifecycle',
        description: 'Ejecuta manualmente la cadencia lifecycle para testing u operaciones.',
        operationId: 'triggerLifecycleCadence',
        security: [
          {
            cronSecret: [],
          },
        ],
        responses: {
          '200': {
            description: 'Cadencia lifecycle procesada exitosamente',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CronJobResponse',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Error al procesar la cadencia lifecycle',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/cron/security-maintenance': {
      get: {
        tags: ['Cron Jobs'],
        summary: 'Mantenimiento de seguridad',
        description:
          'Limpia lockouts antiguos y eventos webhook procesados según políticas de retención.',
        operationId: 'runSecurityMaintenance',
        security: [
          {
            cronSecret: [],
          },
        ],
        responses: {
          '200': {
            description: 'Mantenimiento ejecutado exitosamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    lockoutsDeleted: { type: 'number', example: 5 },
                    webhookEventsDeleted: { type: 'number', example: 120 },
                    lockoutCutoffIso: { type: 'string', format: 'date-time' },
                    webhookCutoffIso: { type: 'string', format: 'date-time' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - CRON_SECRET inválido',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limit excedido',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RateLimitError',
                },
              },
            },
          },
          '500': {
            description: 'Error al ejecutar mantenimiento de seguridad',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Cron Jobs'],
        summary: 'Trigger manual de mantenimiento de seguridad',
        description: 'Ejecuta manualmente la limpieza de lockouts y eventos webhook.',
        operationId: 'triggerSecurityMaintenance',
        security: [
          {
            cronSecret: [],
          },
        ],
        responses: {
          '200': {
            description: 'Mantenimiento ejecutado exitosamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    lockoutsDeleted: { type: 'number', example: 5 },
                    webhookEventsDeleted: { type: 'number', example: 120 },
                    lockoutCutoffIso: { type: 'string', format: 'date-time' },
                    webhookCutoffIso: { type: 'string', format: 'date-time' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '500': {
            description: 'Error al ejecutar mantenimiento de seguridad',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token de autenticación de Supabase',
      },
      cronSecret: {
        type: 'http',
        scheme: 'bearer',
        description: 'Bearer token con CRON_SECRET para autenticación de cron jobs',
      },
    },
    schemas: {
      RecurrenteWebhookEvent: {
        type: 'object',
        required: ['id', 'type', 'data'],
        properties: {
          id: {
            type: 'string',
            description: 'ID único del evento',
            example: 'evt_1234567890',
          },
          type: {
            type: 'string',
            enum: [
              'checkout.completed',
              'payment_intent.succeeded',
              'payment_intent.failed',
              'subscription.created',
              'subscription.canceled',
              'subscription.cancelled',
            ],
            description: 'Tipo de evento',
          },
          data: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'ID del objeto relacionado (checkout, payment_intent, etc.)',
              },
              subscription_id: {
                type: 'string',
                description: 'ID de la suscripción (si aplica)',
              },
              metadata: {
                type: 'object',
                properties: {
                  user_id: {
                    type: 'string',
                    format: 'uuid',
                    description: 'ID del usuario en RutaCero',
                  },
                  plan_code: {
                    type: 'string',
                    enum: ['FREE', 'PRO', 'BUSINESS'],
                    description: 'Código del plan',
                  },
                },
              },
            },
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp de creación del evento',
          },
        },
      },
      CronJobResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
          },
          message: {
            type: 'string',
          },
          sent: {
            type: 'number',
            description: 'Número de recordatorios enviados',
          },
          failed: {
            type: 'number',
            description: 'Número de recordatorios fallidos',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Mensaje de error',
          },
          message: {
            type: 'string',
            description: 'Detalles adicionales del error',
          },
        },
      },
      RateLimitError: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            example: 'Demasiadas solicitudes',
          },
          message: {
            type: 'string',
            example: 'Por favor, intenta de nuevo más tarde',
          },
        },
      },
      ValidationError: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            example: 'Validation failed',
          },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  example: 'data.metadata.user_id',
                },
                message: {
                  type: 'string',
                  example: 'Invalid uuid',
                },
                code: {
                  type: 'string',
                  example: 'invalid_string',
                },
              },
            },
          },
        },
      },
    },
  },
};
