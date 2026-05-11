import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
        sendDefaultPii: false,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        integrations: [
            Sentry.replayIntegration({
                // Privacy posture: mask all text + media by default. Specific
                // public surfaces can opt out via data-sentry-unmask attribute.
                maskAllText: true,
                blockAllMedia: true,
            }),
        ],
        beforeSend(event) {
            if (event.request?.cookies) {
                delete event.request.cookies;
            }
            if (event.user?.email) {
                event.user.email = '[redacted]';
            }
            return event;
        },
        beforeSendTransaction(event) {
            if (event.request?.cookies) {
                delete event.request.cookies;
            }
            return event;
        },
    });
}

// App Router navigation transition tracing
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
