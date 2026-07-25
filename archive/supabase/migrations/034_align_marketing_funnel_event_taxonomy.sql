ALTER TABLE public.marketing_funnel_events
    DROP CONSTRAINT IF EXISTS marketing_funnel_events_event_name_check;

ALTER TABLE public.marketing_funnel_events
    ADD CONSTRAINT marketing_funnel_events_event_name_check
    CHECK (
        event_name IN (
            'landing_viewed',
            'signup_started',
            'email_verified',
            'onboarding_completed',
            'first_debt_added',
            'first_plan_generated',
            'pricing_viewed',
            'checkout_started',
            'payment_succeeded',
            'payment_failed',
            'failed_payment_recovered',
            'subscription_activated',
            'subscription_canceled',
            'dropoff_reported'
        )
    );
