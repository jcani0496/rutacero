# OpenAPI Documentation

Este directorio contiene la especificación OpenAPI 3.0 para la API de RutaCero.

## Acceso a la Documentación

### UI Interactiva (Swagger UI)

Visita la documentación interactiva en tu navegador:

```
http://localhost:3000/docs
```

### Especificación JSON

Obtén la especificación OpenAPI en formato JSON:

```
http://localhost:3000/api/docs
```

## Endpoints Documentados

La documentación incluye:

### Webhooks
- **POST /api/webhooks/recurrente** - Webhook de eventos de Recurrente
  - `checkout.completed`
  - `payment_intent.succeeded`
  - `payment_intent.failed`
  - `subscription.created`
  - `subscription.canceled`

### Payments
- **POST /api/recurrente/create-checkout** - Crear sesión de checkout para suscripción
- **POST /api/recurrente/cancel-subscription** - Cancelar suscripción activa

### Cron Jobs
- **GET /api/cron/payment-reminders** - Procesar recordatorios de pago (programado)
- **POST /api/cron/payment-reminders** - Trigger manual de recordatorios
- **GET /api/cron/security-maintenance** - Limpieza de lockouts/eventos webhook (programado)
- **POST /api/cron/security-maintenance** - Trigger manual de mantenimiento de seguridad

## Autenticación

### Bearer Token (Supabase)
Para endpoints que requieren autenticación de usuario:

```bash
curl -H "Authorization: Bearer YOUR_SUPABASE_JWT_TOKEN" \
  https://api.rutacero.com/api/recurrente/create-checkout
```

### CRON_SECRET
Para endpoints de cron jobs:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://api.rutacero.com/api/cron/payment-reminders
```

## Usar con Herramientas Externas

### Postman

1. Importa la especificación desde: `http://localhost:3000/api/docs`
2. Configura las variables de entorno para autenticación
3. Ejecuta las requests

### Insomnia

1. File → Import → From URL
2. URL: `http://localhost:3000/api/docs`
3. Importar colección

### cURL

Ejemplo de webhook test:

```bash
curl -X POST http://localhost:3000/api/webhooks/recurrente \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_test_123",
    "type": "checkout.completed",
    "data": {
      "id": "checkout_test_456",
      "subscription_id": "sub_test_789",
      "metadata": {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "plan_code": "PRO"
      }
    },
    "created_at": "2024-01-01T12:00:00Z"
  }'
```

## Generar Clientes SDK

### TypeScript/JavaScript

```bash
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3000/api/docs \
  -g typescript-fetch \
  -o ./src/generated/api-client
```

### Python

```bash
openapi-generator generate \
  -i http://localhost:3000/api/docs \
  -g python \
  -o ./python-client
```

### Go

```bash
openapi-generator generate \
  -i http://localhost:3000/api/docs \
  -g go \
  -o ./go-client
```

## Actualizar la Especificación

Para agregar nuevos endpoints a la documentación:

1. Edita `/src/lib/openapi/spec.ts`
2. Agrega el path en el objeto `paths`
3. Define schemas necesarios en `components.schemas`
4. La documentación se actualiza automáticamente

### Ejemplo: Agregar nuevo endpoint

```typescript
export const openApiSpec = {
  // ...
  paths: {
    // ...
    '/api/my-new-endpoint': {
      post: {
        tags: ['MyTag'],
        summary: 'Mi nuevo endpoint',
        description: 'Descripción detallada',
        operationId: 'myNewEndpoint',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MyRequestSchema',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MyResponseSchema',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      MyRequestSchema: {
        type: 'object',
        required: ['field1'],
        properties: {
          field1: {
            type: 'string',
            description: 'Campo requerido',
          },
        },
      },
      MyResponseSchema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
          },
        },
      },
    },
  },
};
```

## Validación de la Especificación

Para validar que la especificación es válida:

```bash
npx swagger-cli validate http://localhost:3000/api/docs
```

## Deployment

En producción, la documentación estará disponible en:

```
https://app.rutacero.com/docs
https://app.rutacero.com/api/docs
```

**IMPORTANTE**: Considera proteger la ruta `/docs` en producción si no quieres que la documentación sea pública.
