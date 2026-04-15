/**
 * RutaCero Microcopy Guide
 *
 * Guía de mensajes y tono para la aplicación.
 * Usar estos mensajes predefinidos para mantener consistencia en toda la app.
 */

// ============================================
// TONO Y VOZ
// ============================================
// - Empático y motivador: Entendemos que las deudas son estresantes
// - Claro y directo: Sin jerga financiera compleja
// - Positivo pero realista: Celebramos victorias, pero somos honestos
// - Profesional pero cercano: "Tú" en lugar de "usted"

// ============================================
// ALERTAS Y ESTADOS
// ============================================

export const ALERTS = {
  // Pagos próximos
  PAYMENT_DUE_TODAY: "Tienes un pago programado para hoy. ¡No lo olvides!",
  PAYMENT_DUE_TOMORROW: "Mañana vence tu pago a {creditor}. Prepárate.",
  PAYMENT_DUE_SOON: "Tu pago a {creditor} vence en {days} días.",
  PAYMENT_OVERDUE: "Tu pago a {creditor} está vencido. Paga lo antes posible para evitar intereses adicionales.",

  // Flujo de caja
  INSUFFICIENT_CASH: "Tu caja proyectada para {period} es baja. Considera ajustar tus gastos variables.",
  CASH_CRITICAL: "Alerta: Tu caja proyectada es insuficiente para cubrir pagos en {period}.",
  CASH_HEALTHY: "Tu flujo de caja se ve saludable para las próximas quincenas.",

  // Presupuesto
  BUDGET_WARNING: "Vas al {percent}% de tu presupuesto de {category}.",
  BUDGET_EXCEEDED: "Has excedido tu presupuesto de {category} por {amount}.",

  // Plan
  PLAN_DEVIATION: "Te has desviado del plan. Considera hacer un pago extra para retomar el rumbo.",
  PLAN_ON_TRACK: "¡Vas por buen camino! Mantén el ritmo.",
  PLAN_AHEAD: "¡Excelente! Estás adelantado en tu plan de pagos.",

  // Victorias
  DEBT_PAID_OFF: "¡Felicidades! Liquidaste tu deuda con {creditor}. 🎉",
  MILESTONE_REACHED: "¡Hito alcanzado! Has pagado {amount} de deuda total.",
} as const;

// ============================================
// ERRORES DE VALIDACIÓN
// ============================================

export const VALIDATION_ERRORS = {
  // Campos requeridos
  REQUIRED_FIELD: "Este campo es requerido.",
  REQUIRED_EMAIL: "Ingresa tu correo electrónico.",
  REQUIRED_AMOUNT: "Ingresa un monto.",
  REQUIRED_DATE: "Selecciona una fecha.",
  REQUIRED_CREDITOR: "Ingresa el nombre del acreedor.",

  // Formato inválido
  INVALID_EMAIL: "El correo electrónico no es válido.",
  INVALID_AMOUNT: "El monto debe ser un número positivo.",
  INVALID_DATE: "La fecha no es válida. Usa formato DD/MM/AAAA.",
  INVALID_APR: "La tasa de interés debe estar entre 0% y 100%.",
  INVALID_DAY: "El día debe estar entre 1 y 31.",

  // Límites
  MIN_AMOUNT: "El monto mínimo es {min}.",
  MAX_AMOUNT: "El monto máximo es {max}.",
  MIN_PAYMENT: "El pago mínimo no puede ser mayor al saldo.",

  // Específicos de deudas
  DUPLICATE_CREDITOR: "Ya tienes una deuda registrada con este acreedor.",
  BALANCE_REQUIRED: "Ingresa el saldo actual de la deuda.",
  MIN_PAYMENT_REQUIRED: "Ingresa el pago mínimo mensual.",
} as const;

// ============================================
// ESTADOS PAST_DUE
// ============================================

export const PAST_DUE_MESSAGES = {
  // Usuario
  SUBSCRIPTION_PAST_DUE: "Tu suscripción está vencida. Actualiza tu método de pago para continuar.",
  SUBSCRIPTION_GRACE_PERIOD: "Tu pago no pudo procesarse. Tienes {days} días para actualizar tu método de pago.",
  SUBSCRIPTION_SUSPENDED: "Tu cuenta está suspendida por falta de pago. Actualiza tu método de pago para reactivar.",
  SUBSCRIPTION_CANCELED: "Tu suscripción fue cancelada. Puedes reactivarla en cualquier momento.",

  // Admin
  ADMIN_RETRY_SCHEDULED: "Reintento de cobro programado para {date}.",
  ADMIN_RETRY_FAILED: "Intento {attempt} de {max} fallido. Próximo intento: {date}.",
  ADMIN_ALL_RETRIES_FAILED: "Todos los intentos de cobro fallaron. Cuenta marcada para suspensión.",
} as const;

// ============================================
// MENSAJES DE ÉXITO
// ============================================

export const SUCCESS_MESSAGES = {
  // CRUD
  DEBT_CREATED: "Deuda agregada correctamente.",
  DEBT_UPDATED: "Deuda actualizada.",
  DEBT_DELETED: "Deuda eliminada.",
  PAYMENT_RECORDED: "Pago registrado. ¡Buen trabajo!",

  // Plan
  PLAN_GENERATED: "Tu plan de pagos está listo.",
  PLAN_ACTIVATED: "Plan activado. ¡Manos a la obra!",
  PLAN_UPDATED: "Plan actualizado.",

  // Perfil
  PROFILE_UPDATED: "Perfil actualizado.",
  SETTINGS_SAVED: "Configuración guardada.",
  PASSWORD_CHANGED: "Contraseña actualizada.",

  // Suscripción
  SUBSCRIPTION_ACTIVATED: "¡Bienvenido a RutaCero Pro!",
  SUBSCRIPTION_CANCELED: "Tu suscripción se cancelará al final del período.",
  PAYMENT_METHOD_UPDATED: "Método de pago actualizado.",
} as const;

// ============================================
// MENSAJES DE CONFIRMACIÓN
// ============================================

export const CONFIRMATION_MESSAGES = {
  DELETE_DEBT: "¿Seguro que quieres eliminar esta deuda? Esta acción no se puede deshacer.",
  CANCEL_SUBSCRIPTION: "¿Seguro que quieres cancelar tu suscripción? Perderás acceso a funciones Pro.",
  CHANGE_PLAN: "¿Cambiar tu estrategia de pago? Se recalculará tu plan.",
  LOG_OUT: "¿Seguro que quieres cerrar sesión?",
  DISCARD_CHANGES: "¿Descartar cambios sin guardar?",
} as const;

// ============================================
// EMPTY STATES
// ============================================

export const EMPTY_STATES = {
  NO_DEBTS: {
    title: "Sin deudas registradas",
    description: "Agrega tu primera deuda para comenzar a planificar tu camino a la libertad financiera.",
    action: "Agregar deuda",
  },
  NO_PLAN: {
    title: "Sin plan activo",
    description: "Genera un plan personalizado para salir de deudas más rápido.",
    action: "Generar plan",
  },
  NO_ALERTS: {
    title: "Todo en orden",
    description: "No tienes alertas pendientes. ¡Sigue así!",
  },
  NO_PAYMENTS: {
    title: "Sin pagos registrados",
    description: "Los pagos que registres aparecerán aquí.",
  },
  NO_RESULTS: {
    title: "Sin resultados",
    description: "No encontramos lo que buscas. Intenta con otros términos.",
  },
} as const;

// ============================================
// LOADING STATES
// ============================================

export const LOADING_MESSAGES = {
  GENERATING_PLAN: "Calculando tu plan óptimo...",
  PROCESSING_PAYMENT: "Procesando pago...",
  LOADING_DATA: "Cargando...",
  SAVING: "Guardando...",
  SYNCING: "Sincronizando...",
} as const;

// ============================================
// TOOLTIPS Y AYUDA
// ============================================

export const HELP_TEXT = {
  APR: "Tasa de Porcentaje Anual. Es el costo total del crédito expresado como porcentaje anual.",
  MIN_PAYMENT: "El pago mínimo mensual requerido para mantener tu cuenta al día.",
  AVALANCHE: "Prioriza las deudas con mayor tasa de interés. Pagas menos interés total.",
  SNOWBALL: "Prioriza las deudas más pequeñas. Genera victorias rápidas y motivación.",
  HYBRID: "Combina lo mejor de avalancha y bola de nieve, balanceando eficiencia y motivación.",
  CASH_FLOW: "Tu flujo de caja proyectado basado en ingresos, gastos y pagos de deuda.",
  EMERGENCY_FUND: "Dinero reservado para imprevistos. Recomendamos mínimo 3 meses de gastos.",
} as const;

// ============================================
// HELPER FUNCTION
// ============================================

/**
 * Reemplaza placeholders en un mensaje con valores dinámicos.
 * @example interpolate("Hola {name}", { name: "Juan" }) // "Hola Juan"
 */
export function interpolate(
  message: string,
  values: Record<string, string | number>
): string {
  return message.replace(/{(\w+)}/g, (_, key) => String(values[key] || `{${key}}`));
}
