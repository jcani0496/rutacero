import * as Sentry from '@sentry/nextjs';

interface InitSentryOptions {
    runtime: 'client' | 'server' | 'edge';
}

export function initSentry(opts: InitSentryOptions): void {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) {
        return;
    }
    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        tracesSampleRate: opts.runtime === 'client' ? 0.1 : 0.05,
        sendDefaultPii: false,
        beforeSend(event) {
            if (event.request?.cookies) {
                delete event.request.cookies;
            }
            if (event.user?.email) {
                event.user.email = '[redacted]';
            }
            return event;
        },
    });
}
