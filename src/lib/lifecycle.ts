/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import {
    debts,
    lifecycleTouchpoints,
    payments,
    plans,
    userNotifications,
    userProfiles,
} from '@/db/schema';
import { isDrizzleEnabled } from '@/lib/data/provider';
import { LifecycleEmail } from '@/lib/emails/lifecycle-email';
import { logEmailEvent } from '@/lib/logger';
import { sendEmail } from '@/lib/resend/client';
import { createAdminClient } from '@/lib/supabase/server';

export type LifecycleCampaignKey =
    | 'ONBOARDING_NUDGE'
    | 'FIRST_PLAN_REMINDER'
    | 'WEEKLY_PROGRESS'
    | 'OVERDUE_NUDGE'
    | 'FAILED_PAYMENT_RECOVERY';

type LifecycleChannel = 'EMAIL' | 'IN_APP';
type LifecycleStatus = 'PENDING' | 'SENT' | 'SKIPPED' | 'FAILED' | 'RECOVERED';

type NotificationType = 'PLAN_NUDGE' | 'OVERDUE' | 'SYSTEM';
type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

interface LifecycleDebtSnapshot {
    id: string;
    creditor: string;
    balance: number;
    currency: string;
    minPayment: number;
    dueDay: number | null;
}

interface LifecyclePlanSnapshot {
    createdAt: string;
    etaDebtFree: string;
    avgPayment: number;
}

interface LifecyclePaymentSnapshot {
    amount: number;
    paymentDate: string;
}

export interface LifecycleUserSnapshot {
    userId: string;
    tenantId: string;
    onboardingCompleted: boolean;
    createdAt: string;
    updatedAt: string;
    lastActiveAt: string | null;
    debts: LifecycleDebtSnapshot[];
    plans: LifecyclePlanSnapshot[];
    paymentsLast7d: LifecyclePaymentSnapshot[];
}

export interface LifecycleTrigger {
    campaign: LifecycleCampaignKey;
    dedupeKey: string;
    metadata: Record<string, unknown>;
}

interface LifecycleNotificationPlan {
    type: NotificationType;
    severity: NotificationSeverity;
    title: string;
    message: string;
}

interface LifecycleEmailPlan {
    template: string;
    subject: string;
    preview: string;
    title: string;
    intro: string;
    bullets: string[];
    ctaLabel: string;
    ctaUrl: string;
    footer?: string;
}

interface LifecycleDispatchCandidate {
    campaign: LifecycleCampaignKey;
    tenantId: string;
    userId: string;
    dedupeKey: string;
    metadata: Record<string, unknown>;
    notification?: LifecycleNotificationPlan;
    email?: LifecycleEmailPlan;
}

interface LifecycleTouchpointRow {
    id: string;
}

interface UserContact {
    email: string | null;
    displayName: string | null;
}

export interface LifecycleProcessResult {
    candidates: number;
    touchpointsCreated: number;
    notificationsCreated: number;
    emailsSent: number;
    skipped: number;
    errors: number;
    campaigns: Record<LifecycleCampaignKey, number>;
}

const ONBOARDING_DAY_LIMIT = 3;
const FIRST_PLAN_DAY_TWO_THRESHOLD = 3;
const FIRST_PLAN_DAY_LIMIT = 7;
const OVERDUE_WINDOW_DAYS = 3;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://rutacero.com';

export function calculateDaysUntilDue(dueDay: number, now: Date): number {
    const todayDay = now.getUTCDate();
    let daysUntilDue = dueDay - todayDay;

    if (daysUntilDue < -15) {
        const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
        daysUntilDue = (daysInMonth - todayDay) + dueDay;
    }

    return daysUntilDue;
}

export function getIsoWeekKey(date: Date): string {
    const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);

    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

function getUtcDayDiff(now: Date, isoDate: string): number {
    const current = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const created = new Date(isoDate);
    const previous = Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate());
    return Math.floor((current - previous) / 86400000);
}

function getDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatDate(isoDate: string): string {
    return new Intl.DateTimeFormat('es-GT', {
        day: 'numeric',
        month: 'short',
    }).format(new Date(isoDate));
}

function summarizeOverdueDebts(snapshot: LifecycleUserSnapshot, now: Date) {
    return snapshot.debts
        .map((debt) => {
            if (debt.dueDay === null) return null;
            const daysUntilDue = calculateDaysUntilDue(debt.dueDay, now);
            const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;
            if (daysOverdue < 1 || daysOverdue > OVERDUE_WINDOW_DAYS) return null;

            return {
                ...debt,
                daysOverdue,
            };
        })
        .filter((debt): debt is LifecycleDebtSnapshot & { daysOverdue: number } => debt !== null);
}

function getUpcomingDebt(snapshot: LifecycleUserSnapshot, now: Date) {
    return snapshot.debts
        .map((debt) => {
            if (debt.dueDay === null) return null;

            return {
                ...debt,
                daysUntilDue: calculateDaysUntilDue(debt.dueDay, now),
            };
        })
        .filter((debt): debt is LifecycleDebtSnapshot & { daysUntilDue: number } => debt !== null)
        .filter((debt) => debt.daysUntilDue >= 0)
        .sort((left, right) => left.daysUntilDue - right.daysUntilDue)[0] || null;
}

function getWeeklySummaryMetrics(snapshot: LifecycleUserSnapshot, now: Date) {
    const totalDebt = snapshot.debts.reduce((sum, debt) => sum + debt.balance, 0);
    const paymentCount = snapshot.paymentsLast7d.length;
    const paymentAmount = snapshot.paymentsLast7d.reduce((sum, payment) => sum + payment.amount, 0);
    const upcomingDebt = getUpcomingDebt(snapshot, now);
    const activePlan = snapshot.plans
        .slice()
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .at(-1) || null;

    return {
        totalDebt,
        paymentCount,
        paymentAmount,
        upcomingDebt,
        activePlan,
    };
}

export function buildLifecycleTriggers(snapshot: LifecycleUserSnapshot, now: Date = new Date()): LifecycleTrigger[] {
    const triggers: LifecycleTrigger[] = [];
    const accountAgeDays = getUtcDayDiff(now, snapshot.createdAt);
    const hasPlan = snapshot.plans.length > 0;

    if (!snapshot.onboardingCompleted) {
        if (accountAgeDays >= 1 && accountAgeDays <= ONBOARDING_DAY_LIMIT) {
            triggers.push({
                campaign: 'ONBOARDING_NUDGE',
                dedupeKey: `onboarding-nudge:day-${accountAgeDays}`,
                metadata: { account_age_days: accountAgeDays },
            });
        }

        return triggers;
    }

    if (!hasPlan && accountAgeDays >= 1 && accountAgeDays <= FIRST_PLAN_DAY_LIMIT) {
        const bucket = accountAgeDays < FIRST_PLAN_DAY_TWO_THRESHOLD ? 'day-1' : 'day-3';
        triggers.push({
            campaign: 'FIRST_PLAN_REMINDER',
            dedupeKey: `first-plan-reminder:${bucket}`,
            metadata: {
                account_age_days: accountAgeDays,
                debt_count: snapshot.debts.length,
            },
        });
    }

    if (hasPlan && snapshot.debts.length > 0) {
        triggers.push({
            campaign: 'WEEKLY_PROGRESS',
            dedupeKey: `weekly-progress:${getIsoWeekKey(now)}`,
            metadata: { iso_week: getIsoWeekKey(now) },
        });
    }

    const overdueDebts = summarizeOverdueDebts(snapshot, now);
    if (overdueDebts.length > 0) {
        triggers.push({
            campaign: 'OVERDUE_NUDGE',
            dedupeKey: `overdue-nudge:${getDateKey(now)}`,
            metadata: {
                overdue_debt_ids: overdueDebts.map((debt) => debt.id),
                overdue_count: overdueDebts.length,
            },
        });
    }

    return triggers;
}

function buildDispatchCandidate(
    snapshot: LifecycleUserSnapshot,
    trigger: LifecycleTrigger,
    now: Date
): LifecycleDispatchCandidate {
    switch (trigger.campaign) {
        case 'ONBOARDING_NUDGE': {
            return {
                campaign: trigger.campaign,
                tenantId: snapshot.tenantId,
                userId: snapshot.userId,
                dedupeKey: trigger.dedupeKey,
                metadata: trigger.metadata,
                email: {
                    template: 'lifecycle-onboarding-nudge',
                    subject: 'Completa tu configuracion para activar RutaCero',
                    preview: 'Termina onboarding para empezar a organizar tus deudas y recordatorios.',
                    title: 'Completa tu configuracion inicial',
                    intro: 'Tu cuenta ya esta creada. Falta terminar la configuracion para que RutaCero pueda activar el plan, recordatorios y seguimiento.',
                    bullets: [
                        'Define tu frecuencia de pago y fechas clave.',
                        'Confirma tu objetivo para que el plan sea realista.',
                        'Termina hoy para pasar directo a tu primera deuda.',
                    ],
                    ctaLabel: 'Terminar onboarding',
                    ctaUrl: `${APP_URL}/onboarding`,
                },
            };
        }
        case 'FIRST_PLAN_REMINDER': {
            const hasDebts = snapshot.debts.length > 0;
            return {
                campaign: trigger.campaign,
                tenantId: snapshot.tenantId,
                userId: snapshot.userId,
                dedupeKey: trigger.dedupeKey,
                metadata: {
                    ...trigger.metadata,
                    has_debts: hasDebts,
                },
                notification: {
                    type: 'PLAN_NUDGE',
                    severity: 'INFO',
                    title: hasDebts ? 'Tu primer plan esta listo para generarse' : 'Agrega tu primera deuda',
                    message: hasDebts
                        ? `Ya cargaste ${snapshot.debts.length} deuda${snapshot.debts.length === 1 ? '' : 's'}. Genera tu primer plan para ver la ruta de salida.`
                        : 'Completa tu primer registro de deuda para que RutaCero pueda calcular una ruta realista.',
                },
                email: {
                    template: 'lifecycle-first-plan-reminder',
                    subject: hasDebts ? 'Genera tu primer plan de salida' : 'Agrega tu primera deuda para empezar',
                    preview: hasDebts
                        ? 'Tu informacion ya permite calcular un plan inicial.'
                        : 'Sin deudas cargadas no podemos construir la primera ruta.',
                    title: hasDebts ? 'Convierte tus datos en un plan' : 'Falta tu primera deuda',
                    intro: hasDebts
                        ? 'Ya tienes suficiente informacion para ver una ruta inicial. El siguiente paso importante para activarte es generar el primer plan.'
                        : 'La activacion real empieza cuando registras tu primera deuda y RutaCero puede calcular un plan.',
                    bullets: hasDebts
                        ? [
                            `${snapshot.debts.length} deuda${snapshot.debts.length === 1 ? '' : 's'} lista${snapshot.debts.length === 1 ? '' : 's'} para calcular.`,
                            'El primer plan desbloquea la visibilidad de payoff y recordatorios.',
                            'Desde ahi puedes decidir si necesitas PRO para profundizar.',
                        ]
                        : [
                            'Empieza con la tarjeta o prestamo que mas presiona tu mes.',
                            'Con una sola deuda ya puedes activar la primera ruta.',
                            'Despues puedes completar el resto sin perder el avance.',
                        ],
                    ctaLabel: hasDebts ? 'Generar mi plan' : 'Agregar una deuda',
                    ctaUrl: hasDebts ? `${APP_URL}/plan` : `${APP_URL}/debts`,
                },
            };
        }
        case 'WEEKLY_PROGRESS': {
            const metrics = getWeeklySummaryMetrics(snapshot, now);
            const currency = snapshot.debts[0]?.currency || 'GTQ';
            const bullets = [
                `Saldo total pendiente: ${formatCurrency(metrics.totalDebt, currency)}.`,
                metrics.paymentCount > 0
                    ? `Pagos registrados esta semana: ${metrics.paymentCount} por ${formatCurrency(metrics.paymentAmount, currency)}.`
                    : 'No registraste pagos en los ultimos 7 dias.',
            ];

            if (metrics.upcomingDebt) {
                bullets.push(
                    `Proximo vencimiento: ${metrics.upcomingDebt.creditor} en ${metrics.upcomingDebt.daysUntilDue} dia${metrics.upcomingDebt.daysUntilDue === 1 ? '' : 's'}.`
                );
            }

            if (metrics.activePlan) {
                bullets.push(`Meta actual: salir de deudas hacia ${formatDate(metrics.activePlan.etaDebtFree)}.`);
            }

            return {
                campaign: trigger.campaign,
                tenantId: snapshot.tenantId,
                userId: snapshot.userId,
                dedupeKey: trigger.dedupeKey,
                metadata: {
                    ...trigger.metadata,
                    total_debt: metrics.totalDebt,
                    payments_last_7d: metrics.paymentAmount,
                    payment_count_last_7d: metrics.paymentCount,
                },
                notification: {
                    type: 'PLAN_NUDGE',
                    severity: metrics.paymentCount > 0 ? 'SUCCESS' : 'INFO',
                    title: 'Resumen semanal de tu ruta',
                    message: metrics.paymentCount > 0
                        ? `Esta semana registraste ${metrics.paymentCount} pago${metrics.paymentCount === 1 ? '' : 's'} y mantuviste movimiento en tu plan.`
                        : 'Tu ruta semanal ya esta lista. Revisa vencimientos y decide tu siguiente paso.',
                },
                email: {
                    template: 'lifecycle-weekly-progress',
                    subject: 'Tu resumen semanal de deuda ya esta listo',
                    preview: 'Saldo pendiente, pagos recientes y siguiente vencimiento en un solo resumen.',
                    title: 'Asi va tu semana financiera',
                    intro: 'Este es el corte semanal para revisar si sigues avanzando, donde puedes acelerar y que vence primero.',
                    bullets,
                    ctaLabel: 'Ver mi progreso',
                    ctaUrl: `${APP_URL}/dashboard`,
                },
            };
        }
        case 'OVERDUE_NUDGE': {
            const overdueDebts = summarizeOverdueDebts(snapshot, now);
            const strongest = overdueDebts[0];
            const overdueNames = overdueDebts.slice(0, 3).map((debt) => debt.creditor).join(', ');

            return {
                campaign: trigger.campaign,
                tenantId: snapshot.tenantId,
                userId: snapshot.userId,
                dedupeKey: trigger.dedupeKey,
                metadata: {
                    ...trigger.metadata,
                    strongest_overdue_days: strongest?.daysOverdue || 0,
                },
                notification: {
                    type: 'OVERDUE',
                    severity: 'CRITICAL',
                    title: 'Tienes pagos vencidos',
                    message: overdueDebts.length === 1
                        ? `${strongest.creditor} lleva ${strongest.daysOverdue} dia${strongest.daysOverdue === 1 ? '' : 's'} vencido.`
                        : `${overdueDebts.length} pagos estan vencidos. Prioriza ${overdueNames}.`,
                },
                email: {
                    template: 'lifecycle-overdue-nudge',
                    subject: 'Hay pagos vencidos que requieren accion',
                    preview: 'RutaCero detecto deuda vencida y priorizo el siguiente paso.',
                    title: 'Necesitas una correccion rapida',
                    intro: 'Detectamos pagos vencidos en tu ruta. El objetivo ahora no es perfeccion, es recuperar el control antes de que los cargos sigan creciendo.',
                    bullets: overdueDebts.map(
                        (debt) => `${debt.creditor}: ${debt.daysOverdue} dia${debt.daysOverdue === 1 ? '' : 's'} de atraso.`
                    ),
                    ctaLabel: 'Registrar pago o revisar deuda',
                    ctaUrl: `${APP_URL}/payments`,
                    footer: 'Este aviso forma parte del baseline de retencion y recuperacion temprana de RutaCero.',
                },
            };
        }
        case 'FAILED_PAYMENT_RECOVERY':
            return {
                campaign: trigger.campaign,
                tenantId: snapshot.tenantId,
                userId: snapshot.userId,
                dedupeKey: trigger.dedupeKey,
                metadata: trigger.metadata,
                notification: {
                    type: 'SYSTEM',
                    severity: 'CRITICAL',
                    title: 'No pudimos renovar tu plan PRO',
                    message: 'Actualiza tu metodo de pago para evitar perder el acceso a las funciones PRO.',
                },
                email: {
                    template: 'lifecycle-failed-payment-recovery',
                    subject: 'No pudimos procesar tu renovacion PRO',
                    preview: 'Tu suscripcion quedo en cobro pendiente y necesita una accion tuya.',
                    title: 'Tu renovacion necesita una accion',
                    intro: 'El ultimo cobro de tu suscripcion PRO no se pudo completar. Tu cuenta sigue visible, pero debes corregir el pago para evitar friccion en el acceso.',
                    bullets: [
                        'Revisa el metodo de pago o vuelve a intentar el checkout.',
                        'Mantener PRO activo evita perder simulaciones, historial y seguimiento completo.',
                        'Este evento queda medido para la revision semanal de conversion y retencion.',
                    ],
                    ctaLabel: 'Resolver pago',
                    ctaUrl: `${APP_URL}/pricing?cta_context=lifecycle_email&offer_variant=failed_payment_recovery`,
                },
            };
    }
}

function initializeCampaignCounts(): Record<LifecycleCampaignKey, number> {
    return {
        ONBOARDING_NUDGE: 0,
        FIRST_PLAN_REMINDER: 0,
        WEEKLY_PROGRESS: 0,
        OVERDUE_NUDGE: 0,
        FAILED_PAYMENT_RECOVERY: 0,
    };
}

async function claimTouchpoint(
    admin: any,
    candidate: LifecycleDispatchCandidate,
    channel: LifecycleChannel
): Promise<LifecycleTouchpointRow | null> {
    if (isDrizzleEnabled()) {
        const db = getDb();
        try {
            const [row] = await db
                .insert(lifecycleTouchpoints)
                .values({
                    tenantId: candidate.tenantId,
                    userId: candidate.userId,
                    campaignKey: candidate.campaign,
                    channel,
                    status: 'PENDING',
                    dedupeKey: candidate.dedupeKey,
                    metadata: candidate.metadata,
                    triggeredAt: new Date(),
                })
                .onConflictDoNothing({
                    target: [
                        lifecycleTouchpoints.tenantId,
                        lifecycleTouchpoints.userId,
                        lifecycleTouchpoints.channel,
                        lifecycleTouchpoints.dedupeKey,
                    ],
                })
                .returning({ id: lifecycleTouchpoints.id });

            return row ?? null;
        } catch (error) {
            // Mirror PostgREST 23505 dedupe: concurrent claim loses the race.
            if (
                error &&
                typeof error === 'object' &&
                'code' in error &&
                (error as { code?: string }).code === '23505'
            ) {
                return null;
            }
            throw error;
        }
    }

    const { data, error } = await admin
        .from('lifecycle_touchpoints')
        .insert({
            tenant_id: candidate.tenantId,
            user_id: candidate.userId,
            campaign_key: candidate.campaign,
            channel,
            status: 'PENDING',
            dedupe_key: candidate.dedupeKey,
            metadata: candidate.metadata,
            triggered_at: new Date().toISOString(),
        })
        .select('id')
        .single();

    if (error) {
        if (error.code === '23505') {
            return null;
        }

        throw error;
    }

    return data as LifecycleTouchpointRow;
}

async function updateTouchpointStatus(
    admin: any,
    touchpointId: string,
    status: LifecycleStatus,
    metadata?: Record<string, unknown>
) {
    if (isDrizzleEnabled()) {
        const db = getDb();
        const payload: {
            status: string;
            deliveredAt?: Date;
            metadata?: Record<string, unknown>;
            updatedAt: Date;
        } = {
            status,
            updatedAt: new Date(),
        };

        if (status === 'SENT' || status === 'RECOVERED') {
            payload.deliveredAt = new Date();
        }

        if (metadata) {
            payload.metadata = metadata;
        }

        await db
            .update(lifecycleTouchpoints)
            .set(payload)
            .where(eq(lifecycleTouchpoints.id, touchpointId));
        return;
    }

    const payload: Record<string, unknown> = {
        status,
    };

    if (status === 'SENT' || status === 'RECOVERED') {
        payload.delivered_at = new Date().toISOString();
    }

    if (metadata) {
        payload.metadata = metadata;
    }

    await admin
        .from('lifecycle_touchpoints')
        .update(payload)
        .eq('id', touchpointId);
}

async function getUserContact(admin: any, userId: string, cache: Map<string, UserContact>): Promise<UserContact> {
    const cached = cache.get(userId);
    if (cached) {
        return cached;
    }

    const { getIdentityUserById } = await import('@/lib/auth/identity');
    const identityUser = await getIdentityUserById(userId);
    if (!identityUser) {
        const fallback = { email: null, displayName: null };
        cache.set(userId, fallback);
        return fallback;
    }

    const contact = {
        email: identityUser.email || null,
        displayName: identityUser.name,
    };
    cache.set(userId, contact);
    return contact;
}

async function insertNotification(admin: any, candidate: LifecycleDispatchCandidate) {
    if (!candidate.notification) return false;

    if (isDrizzleEnabled()) {
        const db = getDb();
        try {
            await db.insert(userNotifications).values({
                tenantId: candidate.tenantId,
                userId: candidate.userId,
                type: candidate.notification.type,
                severity: candidate.notification.severity,
                title: candidate.notification.title,
                message: candidate.notification.message,
                metadata: candidate.metadata,
            });
            return true;
        } catch {
            return false;
        }
    }

    const { error } = await admin
        .from('user_notifications')
        .insert({
            tenant_id: candidate.tenantId,
            user_id: candidate.userId,
            type: candidate.notification.type,
            severity: candidate.notification.severity,
            title: candidate.notification.title,
            message: candidate.notification.message,
            metadata: candidate.metadata,
        });

    return !error;
}

async function sendLifecycleEmailMessage(
    candidate: LifecycleDispatchCandidate,
    contact: UserContact
) {
    if (!candidate.email || !contact.email) {
        return false;
    }

    await sendEmail({
        to: contact.email,
        subject: candidate.email.subject,
        react: LifecycleEmail({
            preview: candidate.email.preview,
            title: candidate.email.title,
            intro: candidate.email.intro,
            bullets: candidate.email.bullets,
            ctaLabel: candidate.email.ctaLabel,
            ctaUrl: candidate.email.ctaUrl,
            footer: candidate.email.footer,
        }),
    });

    logEmailEvent({
        event: 'sent',
        to: contact.email,
        template: candidate.email.template,
        userId: candidate.userId,
    });

    return true;
}

async function dispatchLifecycleCandidate(
    admin: any,
    candidate: LifecycleDispatchCandidate,
    userCache: Map<string, UserContact>,
    result: LifecycleProcessResult
) {
    if (candidate.notification) {
        const touchpoint = await claimTouchpoint(admin, candidate, 'IN_APP');
        if (touchpoint) {
            result.touchpointsCreated++;
            const created = await insertNotification(admin, candidate);
            if (created) {
                result.notificationsCreated++;
                await updateTouchpointStatus(admin, touchpoint.id, 'SENT');
            } else {
                result.errors++;
                await updateTouchpointStatus(admin, touchpoint.id, 'FAILED');
            }
        }
    }

    if (candidate.email) {
        const touchpoint = await claimTouchpoint(admin, candidate, 'EMAIL');
        if (!touchpoint) {
            return;
        }

        result.touchpointsCreated++;
        const contact = await getUserContact(admin, candidate.userId, userCache);
        if (!contact.email) {
            result.skipped++;
            await updateTouchpointStatus(admin, touchpoint.id, 'SKIPPED');
            return;
        }

        try {
            const sent = await sendLifecycleEmailMessage(candidate, contact);
            if (sent) {
                result.emailsSent++;
                await updateTouchpointStatus(admin, touchpoint.id, 'SENT');
            } else {
                result.skipped++;
                await updateTouchpointStatus(admin, touchpoint.id, 'SKIPPED');
            }
        } catch (error) {
            result.errors++;
            logEmailEvent({
                event: 'failed',
                to: contact.email,
                template: candidate.email.template,
                userId: candidate.userId,
                error: error instanceof Error ? error : new Error(String(error)),
            });
            await updateTouchpointStatus(admin, touchpoint.id, 'FAILED');
        }
    }
}

async function loadLifecycleSnapshots(now: Date): Promise<LifecycleUserSnapshot[]> {
    const lookbackDate = new Date(now.getTime() - (7 * 86400000)).toISOString().slice(0, 10);

    type ProfileSnap = {
        user_id: string;
        current_tenant_id: string;
        onboarding_completed: boolean;
        created_at: string;
        updated_at: string;
        last_active_at: string | null;
    };
    type DebtSnapRow = {
        tenant_id: string;
        user_id: string;
        id: string;
        creditor: string;
        balance: string | number;
        currency: string;
        min_payment: string | number;
        due_date: number | null;
    };
    type PlanSnapRow = {
        tenant_id: string;
        user_id: string;
        created_at: string;
        eta_debt_free: string;
        avg_payment: string | number;
    };
    type PaymentSnapRow = {
        tenant_id: string;
        user_id: string;
        amount: string | number;
        payment_date: string;
    };

    let profiles: ProfileSnap[] = [];
    let debtRows: DebtSnapRow[] = [];
    let planRows: PlanSnapRow[] = [];
    let paymentRows: PaymentSnapRow[] = [];

    if (isDrizzleEnabled()) {
        const db = getDb();
        const [profileRows, activeDebts, activePlans, recentPayments] = await Promise.all([
            db
                .select({
                    userId: userProfiles.userId,
                    currentTenantId: userProfiles.currentTenantId,
                    onboardingCompleted: userProfiles.onboardingCompleted,
                    createdAt: userProfiles.createdAt,
                    updatedAt: userProfiles.updatedAt,
                    lastActiveAt: userProfiles.lastActiveAt,
                })
                .from(userProfiles)
                .where(isNotNull(userProfiles.currentTenantId)),
            db
                .select({
                    tenantId: debts.tenantId,
                    userId: debts.userId,
                    id: debts.id,
                    creditor: debts.creditor,
                    balance: debts.balance,
                    currency: debts.currency,
                    minPayment: debts.minPayment,
                    dueDate: debts.dueDate,
                })
                .from(debts)
                .where(eq(debts.status, 'ACTIVE')),
            db
                .select({
                    tenantId: plans.tenantId,
                    userId: plans.userId,
                    createdAt: plans.createdAt,
                    etaDebtFree: plans.etaDebtFree,
                    avgPayment: plans.avgPayment,
                })
                .from(plans)
                .where(eq(plans.active, true)),
            db
                .select({
                    tenantId: payments.tenantId,
                    userId: payments.userId,
                    amount: payments.amount,
                    paymentDate: payments.paymentDate,
                })
                .from(payments)
                .where(gte(payments.paymentDate, lookbackDate)),
        ]);

        profiles = profileRows
            .filter((profile) => Boolean(profile.currentTenantId))
            .map((profile) => ({
                user_id: profile.userId,
                current_tenant_id: profile.currentTenantId as string,
                onboarding_completed: profile.onboardingCompleted,
                created_at:
                    profile.createdAt instanceof Date
                        ? profile.createdAt.toISOString()
                        : String(profile.createdAt),
                updated_at:
                    profile.updatedAt instanceof Date
                        ? profile.updatedAt.toISOString()
                        : String(profile.updatedAt),
                last_active_at: profile.lastActiveAt
                    ? profile.lastActiveAt instanceof Date
                        ? profile.lastActiveAt.toISOString()
                        : String(profile.lastActiveAt)
                    : null,
            }));

        debtRows = activeDebts.map((debt) => ({
            tenant_id: debt.tenantId,
            user_id: debt.userId,
            id: debt.id,
            creditor: debt.creditor,
            balance: debt.balance,
            currency: debt.currency,
            min_payment: debt.minPayment,
            due_date: debt.dueDate,
        }));

        planRows = activePlans.map((plan) => ({
            tenant_id: plan.tenantId,
            user_id: plan.userId,
            created_at:
                plan.createdAt instanceof Date
                    ? plan.createdAt.toISOString()
                    : String(plan.createdAt),
            eta_debt_free: plan.etaDebtFree,
            avg_payment: plan.avgPayment,
        }));

        paymentRows = recentPayments.map((payment) => ({
            tenant_id: payment.tenantId,
            user_id: payment.userId,
            amount: payment.amount,
            payment_date: payment.paymentDate,
        }));
    } else {
        const admin = createAdminClient() as any;

        const [profilesResult, debtsResult, plansResult, paymentsResult] = await Promise.all([
            admin
                .from('user_profiles')
                .select('user_id, current_tenant_id, onboarding_completed, created_at, updated_at, last_active_at'),
            admin
                .from('debts')
                .select('tenant_id, user_id, id, creditor, balance, currency, min_payment, due_date, status')
                .eq('status', 'ACTIVE'),
            admin
                .from('plans')
                .select('tenant_id, user_id, created_at, eta_debt_free, avg_payment')
                .eq('active', true),
            admin
                .from('payments')
                .select('tenant_id, user_id, amount, payment_date')
                .gte('payment_date', lookbackDate),
        ]);

        profiles = (profilesResult.data || []).filter(
            (profile: { current_tenant_id: string | null }) => Boolean(profile.current_tenant_id),
        );
        debtRows = debtsResult.data || [];
        planRows = plansResult.data || [];
        paymentRows = paymentsResult.data || [];
    }

    const debtMap = new Map<string, LifecycleDebtSnapshot[]>();
    for (const debt of debtRows) {
        const key = `${debt.tenant_id}:${debt.user_id}`;
        const current = debtMap.get(key) || [];
        current.push({
            id: debt.id,
            creditor: debt.creditor,
            balance: Number(debt.balance || 0),
            currency: debt.currency || 'GTQ',
            minPayment: Number(debt.min_payment || 0),
            dueDay: typeof debt.due_date === 'number' ? debt.due_date : null,
        });
        debtMap.set(key, current);
    }

    const planMap = new Map<string, LifecyclePlanSnapshot[]>();
    for (const plan of planRows) {
        const key = `${plan.tenant_id}:${plan.user_id}`;
        const current = planMap.get(key) || [];
        current.push({
            createdAt: plan.created_at,
            etaDebtFree: plan.eta_debt_free,
            avgPayment: Number(plan.avg_payment || 0),
        });
        planMap.set(key, current);
    }

    const paymentMap = new Map<string, LifecyclePaymentSnapshot[]>();
    for (const payment of paymentRows) {
        const key = `${payment.tenant_id}:${payment.user_id}`;
        const current = paymentMap.get(key) || [];
        current.push({
            amount: Number(payment.amount || 0),
            paymentDate: payment.payment_date,
        });
        paymentMap.set(key, current);
    }

    return profiles.map((profile) => {
        const key = `${profile.current_tenant_id}:${profile.user_id}`;

        return {
            userId: profile.user_id,
            tenantId: profile.current_tenant_id,
            onboardingCompleted: profile.onboarding_completed,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at,
            lastActiveAt: profile.last_active_at,
            debts: debtMap.get(key) || [],
            plans: planMap.get(key) || [],
            paymentsLast7d: paymentMap.get(key) || [],
        };
    });
}

export async function processLifecycleCampaigns(now: Date = new Date()): Promise<LifecycleProcessResult> {
    const admin = createAdminClient() as any;
    const result: LifecycleProcessResult = {
        candidates: 0,
        touchpointsCreated: 0,
        notificationsCreated: 0,
        emailsSent: 0,
        skipped: 0,
        errors: 0,
        campaigns: initializeCampaignCounts(),
    };
    const userCache = new Map<string, UserContact>();
    const snapshots = await loadLifecycleSnapshots(now);

    for (const snapshot of snapshots) {
        const triggers = buildLifecycleTriggers(snapshot, now);
        result.candidates += triggers.length;

        for (const trigger of triggers) {
            result.campaigns[trigger.campaign]++;
            const candidate = buildDispatchCandidate(snapshot, trigger, now);
            await dispatchLifecycleCandidate(admin, candidate, userCache, result);
        }
    }

    return result;
}

export async function triggerFailedPaymentRecovery(params: {
    tenantId: string;
    userId: string;
    externalEventId?: string | null;
    planCode?: string | null;
}) {
    const admin = createAdminClient() as any;
    const userCache = new Map<string, UserContact>();
    const result: LifecycleProcessResult = {
        candidates: 1,
        touchpointsCreated: 0,
        notificationsCreated: 0,
        emailsSent: 0,
        skipped: 0,
        errors: 0,
        campaigns: initializeCampaignCounts(),
    };

    const candidate: LifecycleDispatchCandidate = {
        campaign: 'FAILED_PAYMENT_RECOVERY',
        tenantId: params.tenantId,
        userId: params.userId,
        dedupeKey: `failed-payment:${params.externalEventId || getDateKey(new Date())}`,
        metadata: {
            external_event_id: params.externalEventId || null,
            plan_code: params.planCode || null,
        },
        notification: {
            type: 'SYSTEM',
            severity: 'CRITICAL',
            title: 'No pudimos renovar tu plan PRO',
            message: 'Actualiza tu metodo de pago para reactivar el acceso completo.',
        },
        email: {
            template: 'lifecycle-failed-payment-recovery',
            subject: 'Tu cobro PRO necesita atencion',
            preview: 'El ultimo cobro no se pudo procesar y RutaCero ya abrio una ruta de recuperacion.',
            title: 'Necesitamos corregir tu pago',
            intro: 'El cobro de tu suscripcion PRO fallo. Queremos que recuperes acceso sin friccion y que el evento quede medido para revisar conversion y retencion.',
            bullets: [
                'Revisa tu metodo de pago o reinicia el checkout.',
                'La suscripcion puede quedar en estado pendiente si no corriges el cobro.',
                'Este recovery se registra para medir tasa de recuperacion de cobro.',
            ],
            ctaLabel: 'Resolver mi pago',
            ctaUrl: `${APP_URL}/pricing?cta_context=lifecycle_email&offer_variant=failed_payment_recovery`,
        },
    };

    result.campaigns.FAILED_PAYMENT_RECOVERY = 1;
    await dispatchLifecycleCandidate(admin, candidate, userCache, result);

    return result;
}

export async function resolveFailedPaymentRecovery(params: {
    tenantId: string;
    userId: string;
}) {
    if (isDrizzleEnabled()) {
        const db = getDb();
        const rows = await db
            .update(lifecycleTouchpoints)
            .set({
                status: 'RECOVERED',
                deliveredAt: new Date(),
                updatedAt: sql`timezone('utc'::text, now())`,
            })
            .where(
                and(
                    eq(lifecycleTouchpoints.tenantId, params.tenantId),
                    eq(lifecycleTouchpoints.userId, params.userId),
                    eq(lifecycleTouchpoints.campaignKey, 'FAILED_PAYMENT_RECOVERY'),
                    inArray(lifecycleTouchpoints.status, ['PENDING', 'SENT', 'FAILED']),
                ),
            )
            .returning({ id: lifecycleTouchpoints.id });

        return rows.length;
    }

    const admin = createAdminClient() as any;
    const { data, error } = await admin
        .from('lifecycle_touchpoints')
        .update({
            status: 'RECOVERED',
            delivered_at: new Date().toISOString(),
        })
        .eq('tenant_id', params.tenantId)
        .eq('user_id', params.userId)
        .eq('campaign_key', 'FAILED_PAYMENT_RECOVERY')
        .in('status', ['PENDING', 'SENT', 'FAILED'])
        .select('id');

    if (error) {
        throw error;
    }

    return Array.isArray(data) ? data.length : 0;
}
