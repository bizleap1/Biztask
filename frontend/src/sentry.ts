import * as Sentry from '@sentry/react';

export const initFrontendSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || 'development',
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 1.0,
    });
    console.log('[Sentry] Frontend monitoring initialized.');
  }
};

export const captureFrontendException = (error: any, errorInfo?: any) => {
  console.error('[Sentry Error Captured]', error, errorInfo);
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureException(error, { extra: errorInfo });
  }
};
