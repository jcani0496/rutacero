type SearchParamRecord = Record<string, string | string[] | undefined>;

type SearchParamsInput =
    | SearchParamRecord
    | URLSearchParams
    | { get(name: string): string | null }
    | null
    | undefined;

interface LaunchCopyBlock {
    heroBadge: string;
    heroHeadlinePrefix: string;
    heroHeadlineWords: string[];
    heroSubheadline: string;
    heroPrimaryLabel: string;
    heroSecondaryLabel: string;
    pricingFreeLabel: string;
    pricingProLabel: string;
    ctaHeadline: string;
    ctaAccent: string;
    ctaDescription: string;
    ctaPrimaryLabel: string;
    ctaSecondaryLabel: string;
    pricingBadge: string;
    pricingTitleLead: string;
    pricingTitleAccent: string;
    pricingDescription: string;
    pricingFinalTitle: string;
    pricingFinalDescription: string;
    pricingFinalCtaLabel: string;
    planUpgradeTitle: string;
    planUpgradeDescription: string;
    planUpgradeCtaLabel: string;
    planUpgradeBullets: string[];
}

export interface LaunchExperience {
    partnerSlug: string | null;
    partnerName: string | null;
    landingVariant: string | null;
    offerVariant: string | null;
    landing: {
        heroBadge: string;
        heroHeadlinePrefix: string;
        heroHeadlineWords: string[];
        heroSubheadline: string;
        heroPrimaryLabel: string;
        heroPrimaryHref: string;
        heroSecondaryLabel: string;
        heroSecondaryHref: string;
        pricingFreeLabel: string;
        pricingFreeHref: string;
        pricingProLabel: string;
        pricingProHref: string;
        ctaHeadline: string;
        ctaAccent: string;
        ctaDescription: string;
        ctaPrimaryLabel: string;
        ctaPrimaryHref: string;
        ctaSecondaryLabel: string;
        ctaSecondaryHref: string;
    };
    pricing: {
        badge: string;
        titleLead: string;
        titleAccent: string;
        description: string;
        proPlanDescription: string;
        checkoutHref: string;
        finalTitle: string;
        finalDescription: string;
        finalCtaLabel: string;
    };
    plan: {
        upgradeTitle: string;
        upgradeDescription: string;
        upgradeCtaLabel: string;
        upgradeCtaHref: string;
        pricingHref: string;
        upgradeBullets: string[];
    };
}

const DEFAULT_COPY: LaunchCopyBlock = {
    heroBadge: 'Ruta clara para deudas en Guatemala',
    heroHeadlinePrefix: 'Sal de deudas',
    heroHeadlineWords: ['más rápido', 'sin estrés', 'con un plan', 'con claridad'],
    heroSubheadline:
        'RutaCero te ayuda a ordenar tarjetas, préstamos, cuotas e incluso deudas informales en quetzales, con estrategias explicables y sin pedir banca en línea.',
    heroPrimaryLabel: 'Empezar gratis',
    heroSecondaryLabel: 'Ya tengo cuenta',
    pricingFreeLabel: 'Empezar gratis',
    pricingProLabel: 'Ver planes PRO',
    ctaHeadline: '¿Listo para decirle',
    ctaAccent: 'adiós a las deudas',
    ctaDescription:
        'Comienza gratis hoy y activa PRO solo cuando necesites más contexto, escenarios y seguimiento.',
    ctaPrimaryLabel: 'Crear mi cuenta gratis',
    ctaSecondaryLabel: 'Ver planes PRO',
    pricingBadge: 'Planes',
    pricingTitleLead: 'Elige el nivel de',
    pricingTitleAccent: 'acompañamiento',
    pricingDescription:
        'Empieza gratis para ordenar tus deudas en GTQ y sube a PRO cuando necesites escenarios avanzados, metas por deuda y más contexto para decidir.',
    pricingFinalTitle: '¿Listo para trabajar tu plan con más contexto?',
    pricingFinalDescription: 'Empieza cuando quieras y cancela cuando lo necesites.',
    pricingFinalCtaLabel: 'Empezar con PRO',
    planUpgradeTitle: 'Ya generaste el plan. PRO te ayuda a ejecutarlo mejor.',
    planUpgradeDescription:
        'Sube a PRO si quieres comparar estrategias, fijar metas por deuda y simular pagos extra antes de comprometerte.',
    planUpgradeCtaLabel: 'Activar PRO',
    planUpgradeBullets: [
        'Compara estrategias y escenarios antes de cambiar tu plan.',
        'Define metas por deuda y deja que el plan se ajuste.',
        'Exporta avances y ten más contexto para seguimiento.',
    ],
};

const LANDING_VARIANT_OVERRIDES: Record<string, Partial<LaunchCopyBlock>> = {
    clarity: {
        heroBadge: 'Más claridad antes de tomar decisiones',
        heroHeadlineWords: ['con claridad', 'sin improvisar', 'viendo el impacto'],
        heroSubheadline:
            'Visualiza el orden correcto de tus deudas, compara escenarios y entiende el impacto de cada pago antes de comprometerte.',
        pricingDescription:
            'Empieza gratis para ordenar tus deudas y sube a PRO cuando necesites comparar escenarios, exportar y decidir con más claridad.',
    },
    momentum: {
        heroBadge: 'Activa movimiento desde la primera semana',
        heroHeadlineWords: ['con momentum', 'paso a paso', 'sin pausar'],
        heroSubheadline:
            'RutaCero te ayuda a convertir tus deudas en una secuencia accionable, con seguimiento claro para sostener el ritmo.',
        pricingFinalTitle: '¿Listo para mover tu plan más rápido?',
    },
};

const OFFER_VARIANT_OVERRIDES: Record<string, Partial<LaunchCopyBlock>> = {
    partner_faststart: {
        pricingFinalTitle: '¿Listo para activar tu acompañamiento completo?',
        pricingFinalDescription:
            'Mantienes el flujo simple para empezar y desbloqueas el seguimiento PRO cuando te haga sentido.',
        pricingFinalCtaLabel: 'Activar acompañamiento PRO',
        planUpgradeCtaLabel: 'Subir a PRO ahora',
    },
    value: {
        pricingDescription:
            'Empieza gratis en GTQ y activa PRO solo cuando el plan necesite simulaciones, metas por deuda o seguimiento más profundo.',
        planUpgradeDescription:
            'Sube a PRO cuando quieras probar escenarios, fijar metas por deuda y exportar avances sin salir de tu flujo actual.',
    },
};

const NAMED_PARTNER_OVERRIDES: Record<string, Partial<LaunchCopyBlock>> = {
    'cooperativa-central': {
        heroBadge: 'Piloto partner con Cooperativa Central',
        heroHeadlineWords: ['con acompañamiento', 'sin improvisar', 'con un plan'],
        heroPrimaryLabel: 'Crear cuenta del piloto',
        pricingBadge: 'Oferta partner',
        pricingFinalCtaLabel: 'Activar PRO del piloto',
    },
};

function readParam(searchParams: SearchParamsInput, key: string): string | null {
    if (!searchParams) return null;

    if (typeof (searchParams as { get?: (name: string) => string | null }).get === 'function') {
        const value = (searchParams as { get(name: string): string | null }).get(key);
        return typeof value === 'string' && value.trim() ? value.trim() : null;
    }

    const rawValue = (searchParams as SearchParamRecord)[key];
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function slugToName(slug: string): string {
    return slug
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function mergeCopy(base: LaunchCopyBlock, override?: Partial<LaunchCopyBlock>): LaunchCopyBlock {
    if (!override) return base;

    return {
        ...base,
        ...override,
        heroHeadlineWords: override.heroHeadlineWords || base.heroHeadlineWords,
        planUpgradeBullets: override.planUpgradeBullets || base.planUpgradeBullets,
    };
}

function buildPartnerBase(partnerName: string): Partial<LaunchCopyBlock> {
    return {
        heroBadge: `RutaCero + ${partnerName}`,
        heroHeadlinePrefix: 'Ordena tus deudas',
        heroHeadlineWords: ['con acompañamiento', 'sin hojas sueltas', 'con una ruta clara'],
        heroSubheadline: `${partnerName} puede compartir este acceso para que empieces gratis, mantengas el contexto del piloto y llegues a checkout sin perder atribución.`,
        heroPrimaryLabel: 'Crear cuenta con acceso gratis',
        pricingFreeLabel: 'Empezar con acceso gratis',
        pricingProLabel: 'Ver upgrade del piloto',
        ctaHeadline: `¿Listo para avanzar con`,
        ctaAccent: partnerName,
        ctaDescription:
            'Mantienes el contexto del piloto y puedes activar PRO cuando necesites más seguimiento, escenarios o exportaciones.',
        pricingBadge: 'Oferta partner',
        pricingTitleLead: 'Activa RutaCero con',
        pricingTitleAccent: partnerName,
        pricingDescription:
            'Empieza gratis para cargar tus deudas y conserva el contexto del partner para activar PRO sin rehacer el flujo.',
        pricingFinalTitle: `¿Listo para continuar con ${partnerName}?`,
        pricingFinalDescription:
            'Puedes empezar gratis y activar PRO más adelante sin perder el contexto del piloto.',
        pricingFinalCtaLabel: 'Activar PRO del piloto',
        planUpgradeTitle: `Ya tienes un plan base. PRO te ayuda a ejecutarlo mejor con ${partnerName}.`,
        planUpgradeDescription:
            'Mantienes el contexto del partner mientras desbloqueas escenarios, metas por deuda y exportaciones.',
        planUpgradeBullets: [
            'Mantiene el contexto del partner a lo largo del upgrade.',
            'Desbloquea comparación de escenarios antes de cambiar el plan.',
            'Permite exportar y dar seguimiento con más detalle.',
        ],
    };
}

export function buildTrackedHref(
    pathname: string,
    searchParams: SearchParamsInput,
    overrides: {
        partnerSlug?: string | null;
        landingVariant?: string | null;
        offerVariant?: string | null;
        ctaContext?: string | null;
    } = {}
): string {
    const nextParams = new URLSearchParams();
    const trackedValues = {
        utm_source: readParam(searchParams, 'utm_source'),
        utm_medium: readParam(searchParams, 'utm_medium'),
        utm_campaign: readParam(searchParams, 'utm_campaign'),
        utm_content: readParam(searchParams, 'utm_content'),
        source: readParam(searchParams, 'source'),
        medium: readParam(searchParams, 'medium'),
        campaign_id: readParam(searchParams, 'campaign_id'),
        campaign_name: readParam(searchParams, 'campaign_name'),
        creative_id: readParam(searchParams, 'creative_id'),
        creative_name: readParam(searchParams, 'creative_name'),
        referral_code: readParam(searchParams, 'referral_code') || readParam(searchParams, 'ref'),
        partner_slug:
            overrides.partnerSlug !== undefined
                ? overrides.partnerSlug
                : readParam(searchParams, 'partner_slug') || readParam(searchParams, 'partner'),
        landing_variant:
            overrides.landingVariant !== undefined
                ? overrides.landingVariant
                : readParam(searchParams, 'landing_variant'),
        offer_variant:
            overrides.offerVariant !== undefined
                ? overrides.offerVariant
                : readParam(searchParams, 'offer_variant'),
        cta_context:
            overrides.ctaContext !== undefined
                ? overrides.ctaContext
                : readParam(searchParams, 'cta_context'),
        plan_strategy: readParam(searchParams, 'plan_strategy'),
    };

    for (const [key, value] of Object.entries(trackedValues)) {
        if (value) {
            nextParams.set(key, value);
        }
    }

    const query = nextParams.toString();
    return query ? `${pathname}?${query}` : pathname;
}

export function resolveLaunchExperience(input: {
    searchParams?: SearchParamsInput;
    partnerSlug?: string | null;
}): LaunchExperience {
    const partnerSlug =
        input.partnerSlug ||
        readParam(input.searchParams, 'partner_slug') ||
        readParam(input.searchParams, 'partner');
    const partnerName = partnerSlug ? slugToName(partnerSlug) : null;
    const landingVariant =
        readParam(input.searchParams, 'landing_variant') ||
        (partnerSlug ? `partner-${partnerSlug}` : null);
    const offerVariant = readParam(input.searchParams, 'offer_variant');

    const partnerCopy = partnerSlug && partnerName
        ? mergeCopy(
            mergeCopy(DEFAULT_COPY, buildPartnerBase(partnerName)),
            NAMED_PARTNER_OVERRIDES[partnerSlug]
        )
        : DEFAULT_COPY;
    const variantCopy = mergeCopy(partnerCopy, landingVariant ? LANDING_VARIANT_OVERRIDES[landingVariant] : undefined);
    const copy = mergeCopy(variantCopy, offerVariant ? OFFER_VARIANT_OVERRIDES[offerVariant] : undefined);

    return {
        partnerSlug,
        partnerName,
        landingVariant,
        offerVariant,
        landing: {
            heroBadge: copy.heroBadge,
            heroHeadlinePrefix: copy.heroHeadlinePrefix,
            heroHeadlineWords: copy.heroHeadlineWords,
            heroSubheadline: copy.heroSubheadline,
            heroPrimaryLabel: copy.heroPrimaryLabel,
            heroPrimaryHref: buildTrackedHref('/signup', input.searchParams, {
                partnerSlug,
                landingVariant,
                offerVariant,
                ctaContext: 'landing_signup',
            }),
            heroSecondaryLabel: copy.heroSecondaryLabel,
            heroSecondaryHref: buildTrackedHref('/login', input.searchParams, {
                partnerSlug,
                landingVariant,
                offerVariant,
            }),
            pricingFreeLabel: copy.pricingFreeLabel,
            pricingFreeHref: buildTrackedHref('/signup', input.searchParams, {
                partnerSlug,
                landingVariant,
                offerVariant,
                ctaContext: 'landing_signup',
            }),
            pricingProLabel: copy.pricingProLabel,
            pricingProHref: buildTrackedHref('/pricing', input.searchParams, {
                partnerSlug,
                landingVariant,
                offerVariant,
                ctaContext: 'landing_pricing',
            }),
            ctaHeadline: copy.ctaHeadline,
            ctaAccent: copy.ctaAccent,
            ctaDescription: copy.ctaDescription,
            ctaPrimaryLabel: copy.ctaPrimaryLabel,
            ctaPrimaryHref: buildTrackedHref('/signup', input.searchParams, {
                partnerSlug,
                landingVariant,
                offerVariant,
                ctaContext: 'landing_signup',
            }),
            ctaSecondaryLabel: copy.ctaSecondaryLabel,
            ctaSecondaryHref: buildTrackedHref('/pricing', input.searchParams, {
                partnerSlug,
                landingVariant,
                offerVariant,
                ctaContext: 'landing_pricing',
            }),
        },
        pricing: {
            badge: copy.pricingBadge,
            titleLead: copy.pricingTitleLead,
            titleAccent: copy.pricingTitleAccent,
            description: copy.pricingDescription,
            proPlanDescription: offerVariant === 'partner_faststart'
                ? 'Para mantener el contexto del piloto y sumar seguimiento, metas y exportaciones.'
                : partnerName
                    ? `Para continuar el flujo de ${partnerName} con más seguimiento, exportaciones y metas por deuda.`
                    : 'Para quienes necesitan más contexto, escenarios y seguimiento',
            checkoutHref: buildTrackedHref('/checkout', input.searchParams, {
                partnerSlug,
                landingVariant,
                offerVariant,
                ctaContext: 'pricing',
            }),
            finalTitle: copy.pricingFinalTitle,
            finalDescription: copy.pricingFinalDescription,
            finalCtaLabel: copy.pricingFinalCtaLabel,
        },
        plan: {
            upgradeTitle: copy.planUpgradeTitle,
            upgradeDescription: copy.planUpgradeDescription,
            upgradeCtaLabel: copy.planUpgradeCtaLabel,
            upgradeCtaHref: buildTrackedHref('/checkout', input.searchParams, {
                partnerSlug,
                landingVariant,
                offerVariant,
                ctaContext: 'plan',
            }),
            pricingHref: buildTrackedHref('/pricing', input.searchParams, {
                partnerSlug,
                landingVariant,
                offerVariant,
                ctaContext: 'plan_pricing',
            }),
            upgradeBullets: copy.planUpgradeBullets,
        },
    };
}
