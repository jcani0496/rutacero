export const DROPOFF_SURFACES = [
    'landing',
    'pricing',
    'signup',
    'checkout',
    'paywall',
    'plan',
] as const;

export type DropoffSurface = (typeof DROPOFF_SURFACES)[number];

interface DropoffSurfaceConfig {
    title: string;
    description: string;
    triggerLabel: string;
    submitLabel: string;
    successTitle: string;
    successDescription: string;
    reasons: string[];
}

export const DROPOFF_SURFACE_CONFIG: Record<DropoffSurface, DropoffSurfaceConfig> = {
    landing: {
        title: 'Si no estas listo, cuentanos por que',
        description: 'Nos ayuda a mejorar el primer contacto con usuarios en Guatemala.',
        triggerLabel: 'Compartir motivo',
        submitLabel: 'Enviar comentario',
        successTitle: 'Gracias por contarnos',
        successDescription: 'Usaremos esto para mejorar la landing y reducir friccion.',
        reasons: [
            'No entiendo bien como funciona',
            'No confio todavia en compartir mis datos',
            'Quiero ver precios o beneficios mas claros',
            'Todavia no estoy listo para empezar',
            'Necesito validar si aplica a mis deudas',
            'Otro motivo',
        ],
    },
    pricing: {
        title: 'Que te detiene para elegir un plan',
        description: 'Tomamos estas respuestas para ajustar la oferta y el mensaje de valor.',
        triggerLabel: 'Decir que me falta',
        submitLabel: 'Enviar friccion',
        successTitle: 'Comentario recibido',
        successDescription: 'Esto nos ayuda a mejorar la propuesta antes del checkout.',
        reasons: [
            'No veo suficiente valor en PRO',
            'El precio no me convence todavia',
            'Necesito mas pruebas de seguridad o confianza',
            'Quiero comparar con otra opcion',
            'Prefiero seguir con el plan gratis',
            'Otro motivo',
        ],
    },
    signup: {
        title: 'Antes de salir, que te frena para crear tu cuenta',
        description: 'Con esto ajustamos el alta para que sea mas clara y rapida.',
        triggerLabel: 'Compartir bloqueo',
        submitLabel: 'Enviar bloqueo',
        successTitle: 'Gracias por el contexto',
        successDescription: 'Vamos a usarlo para simplificar el registro.',
        reasons: [
            'No quiero verificar por correo ahora',
            'Tengo dudas sobre privacidad o seguridad',
            'No estoy listo para cargar mis deudas',
            'Quiero entender mejor el beneficio antes de registrarme',
            'Prefiero hacerlo despues',
            'Otro motivo',
        ],
    },
    checkout: {
        title: 'Si pausaste el pago, cuentanos por que',
        description: 'Queremos reducir friccion real antes del cobro.',
        triggerLabel: 'Compartir motivo',
        submitLabel: 'Enviar motivo',
        successTitle: 'Gracias por avisarnos',
        successDescription: 'Tomamos estas respuestas para mejorar checkout y confianza.',
        reasons: [
            'No estoy listo para pagar hoy',
            'Necesito mas confianza en el cobro',
            'Quiero entender mejor que desbloquea PRO',
            'Prefiero hablar con alguien primero',
            'Voy a volver despues',
            'Otro motivo',
        ],
    },
    paywall: {
        title: 'Que te falta para subir a PRO',
        description: 'Esto nos ayuda a mejorar el paywall y el momento de upgrade.',
        triggerLabel: 'Decirnos que falta',
        submitLabel: 'Enviar respuesta',
        successTitle: 'Respuesta guardada',
        successDescription: 'Gracias. Vamos a usarla para mejorar este upgrade prompt.',
        reasons: [
            'No veo el beneficio para mi caso',
            'Quiero probar mas antes de pagar',
            'El upgrade aparecio demasiado pronto',
            'Necesito saber si vale la pena para mis deudas',
            'El precio me detiene',
            'Otro motivo',
        ],
    },
    plan: {
        title: 'Que te falta para trabajar este plan con PRO',
        description: 'Queremos entender que hace falta despues de generar un plan real.',
        triggerLabel: 'Compartir friccion',
        submitLabel: 'Enviar friccion',
        successTitle: 'Gracias por contarlo',
        successDescription: 'Lo tomaremos para mejorar el momento de conversion despues del plan.',
        reasons: [
            'No veo suficiente diferencia frente al plan gratis',
            'Necesito mas pruebas antes de pagar',
            'Quiero mas tiempo con el plan actual',
            'El precio no me cierra todavia',
            'Quiero hablar con soporte primero',
            'Otro motivo',
        ],
    },
};
