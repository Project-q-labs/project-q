/**
 * Sentry — Edge runtime config
 *
 * For Next.js middleware and edge routes. Currently we don't use edge
 * runtime, but Sentry recommends having this initialized in case we
 * add edge handlers later.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,

    beforeSend(event) {
      if (process.env.NODE_ENV === "development") return null;
      return event;
    },
  });
}
