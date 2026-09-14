import { writeFileSync } from 'node:fs';

const config = {
  sentryDsn: process.env.SENTRY_DSN || '',
  environment: process.env.SENTRY_ENVIRONMENT || 'production',
  release: process.env.RELEASE_SHA || '',
};
writeFileSync('public/observability-config.js', `window.__EDUNEXIFY_OBSERVABILITY__ = ${JSON.stringify(config)};\n`);
