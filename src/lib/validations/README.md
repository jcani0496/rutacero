# API Validation with Zod

Este directorio contiene todos los esquemas de validación Zod utilizados en las API routes y server actions.

## Uso Básico

### En API Routes

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createDebtSchema, ValidationError, validationErrorResponse } from '@/lib/validations/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createDebtSchema.parse(body);

    // Usar validated data...
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return validationErrorResponse(error);
    }
    // Otros errores...
  }
}
```

### Con Helper Functions

```typescript
import { validateRequestBody, createPaymentSchema } from '@/lib/validations/api';

export async function POST(request: NextRequest) {
  try {
    const validated = await validateRequestBody(request, createPaymentSchema);
    // validated es type-safe
  } catch (error) {
    // ...
  }
}
```

### Validación de Query Parameters

```typescript
import { validateQueryParams, paginationSchema } from '@/lib/validations/api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const params = validateQueryParams(searchParams, paginationSchema);

  // params.page y params.limit están validados
}
```

## Esquemas Disponibles

### Deudas
- `createDebtSchema` - Crear nueva deuda
- `updateDebtSchema` - Actualizar deuda existente
- `debtFilterSchema` - Filtros de búsqueda

### Pagos
- `createPaymentSchema` - Registrar pago
- `paymentFilterSchema` - Filtros de búsqueda

### Ingresos
- `createIncomeSchema` - Registrar ingreso
- `updateIncomeSchema` - Actualizar ingreso

### Gastos
- `createEssentialExpenseSchema` - Registrar gasto esencial
- `updateEssentialExpenseSchema` - Actualizar gasto

### Planes
- `generatePlanSchema` - Generar plan de pago
- `planStrategySchema` - Estrategia de plan

### Webhooks
- `recurrenteWebhookEventSchema` - Eventos de Recurrente

## Agregar Nuevos Esquemas

1. Definir el schema en `api.ts`:

```typescript
export const myNewSchema = z.object({
  field: z.string().min(1, 'Campo requerido'),
  number: positiveNumberSchema,
});
```

2. Exportar el tipo (opcional):

```typescript
export type MyNewData = z.infer<typeof myNewSchema>;
```

3. Usar en tu API route:

```typescript
const validated = myNewSchema.parse(data);
```

## Manejo de Errores

La clase `ValidationError` proporciona mensajes de error estructurados:

```json
{
  "error": "Validation failed",
  "issues": [
    {
      "path": "email",
      "message": "Email inválido",
      "code": "invalid_string"
    }
  ]
}
```

## Validaciones Comunes

- `uuidSchema` - UUIDs válidos
- `emailSchema` - Emails válidos
- `currencySchema` - GTQ o USD
- `positiveNumberSchema` - Números positivos
- `nonNegativeNumberSchema` - Números >= 0

## Testing

```typescript
import { createDebtSchema } from '@/lib/validations/api';

test('validates debt creation', () => {
  const valid = {
    name: 'Tarjeta Visa',
    type: 'CREDIT_CARD',
    balance: 5000,
    apr: 18.5,
    minimum_payment: 150,
    due_day: 15,
    currency: 'GTQ',
  };

  expect(() => createDebtSchema.parse(valid)).not.toThrow();
});
```
