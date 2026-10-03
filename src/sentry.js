// Error reporting. Import this first so it runs before any other module and
// also reports errors thrown while they load.
import * as Sentry from '@sentry/browser';

// Only initialize Sentry for production builds; errors during local
// development stay local instead of polluting the Sentry project. Preview
// builds (preview.chill-flight.pages.dev) report under their own environment.
if (import.meta.env.PROD) {
  Sentry.init({
    environment:
      import.meta.env.VITE_PREVIEW === 'true' ? 'preview' : 'production',
    dsn: 'https://7d9671463431e10775c66852b238ad8e@o4511337089400832.ingest.us.sentry.io/4511346247532544',
    tracesSampleRate: 0.1,
    maxBreadcrumbs: 30,
  });
}
