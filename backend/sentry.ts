import * as Sentry from '@sentry/node';

export const initSentry = () => {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0,
    });
    console.log('[Sentry] Backend monitoring initialized.');
  }
};

export const captureException = (err: any) => {
  console.error('[Error Captured]', err);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
};
