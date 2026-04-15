'use client';

import { type ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { trackMarketingEvent } from '@/lib/funnel/client';
import { BrandLogo } from '@/components/brand-logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, ArrowLeft, Loader2, DollarSign, Calendar, Target, CheckCircle2, Rocket, Coins, Scale } from 'lucide-react';

type Step = 'currency' | 'frequency' | 'goal' | 'complete';

interface OnboardingData {
    currency_base: 'GTQ' | 'USD';
    pay_frequency: 'BIWEEKLY' | 'MONTHLY' | 'VARIABLE';
    pay_dates: number[];
    goal_type: 'FASTEST' | 'LEAST_INTEREST' | 'BALANCED';
}

const PAY_DATE_OPTIONS = {
    BIWEEKLY: [
        { label: '15 y 30 de cada mes', value: [15, 30] },
        { label: '14 y 28 de cada mes', value: [14, 28] },
        { label: '1 y 15 de cada mes', value: [1, 15] },
    ],
    MONTHLY: [
        { label: 'Fin de mes (30/31)', value: [30] },
        { label: 'Día 15', value: [15] },
        { label: 'Día 1', value: [1] },
    ],
};

const STEPS: Step[] = ['currency', 'frequency', 'goal', 'complete'];

const STEP_META: Record<Step, { label: string; titleId: string }> = {
    currency: { label: 'Moneda', titleId: 'onboarding-step-currency-title' },
    frequency: { label: 'Ingresos', titleId: 'onboarding-step-frequency-title' },
    goal: { label: 'Objetivo', titleId: 'onboarding-step-goal-title' },
    complete: { label: 'Resumen', titleId: 'onboarding-step-complete-title' },
};

const DEFAULT_SAVE_ERROR = 'No pudimos guardar tu configuración. Revisa tu conexión e intenta nuevamente.';
const SESSION_SAVE_ERROR = 'Tu sesión expiró. Vuelve a iniciar sesión para completar tu perfil.';

interface OnboardingOptionCardProps {
    name: string;
    value: string;
    checked: boolean;
    onChange: () => void;
    children: ReactNode;
    className: string;
}

function OnboardingOptionCard({ name, value, checked, onChange, children, className }: OnboardingOptionCardProps) {
    return (
        <label className="cursor-pointer">
            <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                onChange={onChange}
                className="peer sr-only"
            />
            <div
                className={`${className} peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-slate-400`}
            >
                {children}
            </div>
        </label>
    );
}

function getOnboardingErrorMessage(error: unknown) {
    if (error instanceof Error && error.message === 'No user found') {
        return SESSION_SAVE_ERROR;
    }

    return DEFAULT_SAVE_ERROR;
}

export default function OnboardingPage() {
    const [step, setStep] = useState<Step>('currency');
    const [isLoading, setIsLoading] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [data, setData] = useState<OnboardingData>({
        currency_base: 'GTQ',
        pay_frequency: 'BIWEEKLY',
        pay_dates: [15, 30],
        goal_type: 'BALANCED',
    });
    const router = useRouter();
    const supabase = createClient();

    const currentIndex = STEPS.indexOf(step);
    const progress = Math.round(((currentIndex + 1) / STEPS.length) * 100);
    const currentStepMeta = STEP_META[step];

    const handleNext = () => {
        setSaveError(null);
        const nextIndex = currentIndex + 1;
        if (nextIndex < STEPS.length) {
            setStep(STEPS[nextIndex]);
        }
    };

    const handleBack = () => {
        setSaveError(null);
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
            setStep(STEPS[prevIndex]);
        }
    };

    const handleComplete = async () => {
        setIsLoading(true);
        setSaveError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            // Create or update user profile
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.from('user_profiles') as any).upsert({
                user_id: user.id,
                currency_base: data.currency_base,
                pay_frequency: data.pay_frequency,
                pay_dates: data.pay_dates,
                goal_type: data.goal_type,
                onboarding_completed: true,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }, {
                onConflict: 'user_id',
            });

            if (error) throw error;

            void trackMarketingEvent({
                eventName: 'onboarding_completed',
                ctaContext: 'signup',
            });
            router.push('/dashboard');
        } catch (error) {
            console.error('Error completing onboarding:', error);
            setSaveError(getOnboardingErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.12),transparent_45%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(14,165,233,0.12),transparent_50%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
            <div className="relative w-full max-w-md sm:max-w-lg lg:max-w-xl space-y-4 sm:space-y-6">
                {/* Logo */}
                <div className="text-center space-y-3">
                    <BrandLogo className="mx-auto" height={50} />
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Configura tu perfil</h1>
                    <p className="text-sm text-slate-500">
                        Solo te tomará un minuto. Esto nos ayuda a personalizar tu plan.
                    </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        <span>Paso {currentIndex + 1} de {STEPS.length}</span>
                        <span className="text-slate-700">{currentStepMeta.label}</span>
                    </div>
                    <div
                        role="progressbar"
                        aria-label="Progreso del onboarding"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        aria-valuetext={`${currentStepMeta.label}. Paso ${currentIndex + 1} de ${STEPS.length}`}
                        className="h-2 bg-slate-200 rounded-full overflow-hidden"
                    >
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <ol className="grid grid-cols-4 gap-2 text-[11px] font-medium text-slate-500" aria-label="Pasos del onboarding">
                        {STEPS.map((itemStep, index) => (
                            <li
                                key={itemStep}
                                aria-current={itemStep === step ? 'step' : undefined}
                                className={`rounded-full border px-2 py-1 text-center transition-colors ${itemStep === step
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-white/80'
                                    }`}
                            >
                                {index + 1}. {STEP_META[itemStep].label}
                            </li>
                        ))}
                    </ol>
                </div>

                <Card className="border-slate-200 bg-white/90 backdrop-blur-xl shadow-xl">
                    {/* Step: Currency */}
                    {step === 'currency' && (
                        <>
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2">
                                    <DollarSign className="w-6 h-6 text-emerald-600" />
                                </div>
                                <h2 id={STEP_META.currency.titleId} className="text-xl font-semibold tracking-tight text-slate-900">¿Cuál es tu moneda principal?</h2>
                                <CardDescription className="text-slate-500">
                                    Usaremos esta moneda como base para tus cálculos
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-labelledby={STEP_META.currency.titleId}>
                                    {[
                                        { value: 'GTQ', label: 'Quetzales', abbr: 'Q' },
                                        { value: 'USD', label: 'Dólares', abbr: '$' },
                                    ].map((currency) => (
                                        <OnboardingOptionCard
                                            key={currency.value}
                                            name="currency_base"
                                            value={currency.value}
                                            checked={data.currency_base === currency.value}
                                            onChange={() => setData({ ...data, currency_base: currency.value as 'GTQ' | 'USD' })}
                                            className={`p-4 rounded-xl border-2 transition-all duration-200 ${data.currency_base === currency.value
                                                ? 'border-emerald-500 bg-emerald-500/10'
                                                : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50'
                                                }`}
                                        >
                                            <div className={`text-3xl font-bold mb-2 ${data.currency_base === currency.value ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                {currency.abbr}
                                            </div>
                                            <div className={`font-medium ${data.currency_base === currency.value ? 'text-emerald-700' : 'text-slate-900'}`}>
                                                {currency.value}
                                            </div>
                                            <div className="text-sm text-slate-500">{currency.label}</div>
                                        </OnboardingOptionCard>
                                    ))}
                                </div>
                            </CardContent>
                        </>
                    )}

                    {/* Step: Pay Frequency */}
                    {step === 'frequency' && (
                        <>
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center mb-2">
                                    <Calendar className="w-6 h-6 text-sky-600" />
                                </div>
                                <h2 id={STEP_META.frequency.titleId} className="text-xl font-semibold tracking-tight text-slate-900">¿Cada cuánto recibes tu ingreso?</h2>
                                <CardDescription className="text-slate-500">
                                    Organizaremos tus pagos según tu frecuencia de ingresos
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3" role="radiogroup" aria-labelledby={STEP_META.frequency.titleId}>
                                    {[
                                        { value: 'BIWEEKLY', label: 'Quincenal', desc: 'Recibo pago cada 15 días' },
                                        { value: 'MONTHLY', label: 'Mensual', desc: 'Recibo pago una vez al mes' },
                                        { value: 'VARIABLE', label: 'Variable', desc: 'Mis ingresos varían (comisiones, freelance)' },
                                    ].map((freq) => (
                                        <OnboardingOptionCard
                                            key={freq.value}
                                            name="pay_frequency"
                                            value={freq.value}
                                            checked={data.pay_frequency === freq.value}
                                            onChange={() => {
                                                const newFreq = freq.value as OnboardingData['pay_frequency'];
                                                const defaultDates = newFreq === 'BIWEEKLY' ? [15, 30] : newFreq === 'MONTHLY' ? [30] : [];
                                                setData({ ...data, pay_frequency: newFreq, pay_dates: defaultDates });
                                            }}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${data.pay_frequency === freq.value
                                                ? 'border-sky-500 bg-sky-500/10'
                                                : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50'
                                                }`}
                                        >
                                            <div className={`font-medium ${data.pay_frequency === freq.value ? 'text-sky-700' : 'text-slate-900'}`}>
                                                {freq.label}
                                            </div>
                                            <div className="text-sm text-slate-500">{freq.desc}</div>
                                        </OnboardingOptionCard>
                                    ))}
                                </div>

                                {data.pay_frequency !== 'VARIABLE' && (
                                    <div className="space-y-2 pt-2">
                                        <Label className="text-slate-600">Días de pago</Label>
                                        <Select
                                            value={JSON.stringify(data.pay_dates)}
                                            onValueChange={(value) => setData({ ...data, pay_dates: JSON.parse(value) })}
                                        >
                                            <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white border-slate-200">
                                                {PAY_DATE_OPTIONS[data.pay_frequency as 'BIWEEKLY' | 'MONTHLY']?.map((option) => (
                                                    <SelectItem
                                                        key={option.label}
                                                        value={JSON.stringify(option.value)}
                                                        className="text-slate-700 hover:bg-slate-100"
                                                    >
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </CardContent>
                        </>
                    )}

                    {/* Step: Goal */}
                    {step === 'goal' && (
                        <>
                            <CardHeader>
                                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-2">
                                    <Target className="w-6 h-6 text-indigo-600" />
                                </div>
                                <h2 id={STEP_META.goal.titleId} className="text-xl font-semibold tracking-tight text-slate-900">¿Cuál es tu objetivo principal?</h2>
                                <CardDescription className="text-slate-500">
                                    Personalizaremos tu plan de pago según tu prioridad
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3" role="radiogroup" aria-labelledby={STEP_META.goal.titleId}>
                                {[
                                    {
                                        value: 'FASTEST',
                                        label: 'Salir lo más rápido posible',
                                        desc: 'Prioriza las deudas pequeñas para ganar impulso',
                                        iconType: 'rocket',
                                    },
                                    {
                                        value: 'LEAST_INTEREST',
                                        label: 'Pagar menos intereses',
                                        desc: 'Ataca primero las deudas con tasa más alta',
                                        iconType: 'coins',
                                    },
                                    {
                                        value: 'BALANCED',
                                        label: 'Balance entre ambos',
                                        desc: 'Combinación inteligente de rapidez y ahorro',
                                        iconType: 'scale',
                                    },
                                ].map((goal) => (
                                    <OnboardingOptionCard
                                        key={goal.value}
                                        name="goal_type"
                                        value={goal.value}
                                        checked={data.goal_type === goal.value}
                                        onChange={() => setData({ ...data, goal_type: goal.value as OnboardingData['goal_type'] })}
                                        className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${data.goal_type === goal.value
                                            ? 'border-indigo-500 bg-indigo-500/10'
                                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg ${data.goal_type === goal.value ? 'bg-indigo-500/20' : 'bg-slate-100'}`}>
                                                {goal.iconType === 'rocket' && <Rocket className={`w-5 h-5 ${data.goal_type === goal.value ? 'text-indigo-600' : 'text-slate-400'}`} />}
                                                {goal.iconType === 'coins' && <Coins className={`w-5 h-5 ${data.goal_type === goal.value ? 'text-indigo-600' : 'text-slate-400'}`} />}
                                                {goal.iconType === 'scale' && <Scale className={`w-5 h-5 ${data.goal_type === goal.value ? 'text-indigo-600' : 'text-slate-400'}`} />}
                                            </div>
                                            <div>
                                                <div className={`font-medium ${data.goal_type === goal.value ? 'text-indigo-700' : 'text-slate-900'}`}>
                                                    {goal.label}
                                                </div>
                                                <div className="text-sm text-slate-500">{goal.desc}</div>
                                            </div>
                                        </div>
                                    </OnboardingOptionCard>
                                ))}
                            </CardContent>
                        </>
                    )}

                    {/* Step: Complete */}
                    {step === 'complete' && (
                        <>
                            <CardHeader className="text-center">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                                </div>
                                <h2 id={STEP_META.complete.titleId} className="text-xl font-semibold tracking-tight text-slate-900">¡Todo listo!</h2>
                                <CardDescription className="text-slate-500">
                                    Tu perfil está configurado. Ahora puedes comenzar a registrar tus deudas.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {saveError && (
                                    <Alert variant="destructive" aria-live="assertive">
                                        <AlertTitle>No pudimos completar tu onboarding</AlertTitle>
                                        <AlertDescription>{saveError}</AlertDescription>
                                    </Alert>
                                )}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Moneda</span>
                                        <span className="text-slate-900 font-medium">{data.currency_base}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Frecuencia</span>
                                        <span className="text-slate-900 font-medium">
                                            {data.pay_frequency === 'BIWEEKLY' ? 'Quincenal' : data.pay_frequency === 'MONTHLY' ? 'Mensual' : 'Variable'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Objetivo</span>
                                        <span className="text-slate-900 font-medium">
                                            {data.goal_type === 'FASTEST' ? 'Lo más rápido' : data.goal_type === 'LEAST_INTEREST' ? 'Menos intereses' : 'Balanceado'}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </>
                    )}

                    {/* Navigation buttons */}
                    <div className="p-6 pt-0 flex gap-3">
                        {currentIndex > 0 && step !== 'complete' && (
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                className="border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Atrás
                            </Button>
                        )}
                        {step !== 'complete' ? (
                            <Button
                                onClick={handleNext}
                                className="flex-1 bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white"
                            >
                                Continuar
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleComplete}
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        Ir al dashboard
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
