/**
 * Sentry — Server (Node.js) config
 *
 * Captures errors in API routes and server-rendered pages.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,

    // Server-side noise to ignore
    ignoreErrors: [
      "AbortError",         // user cancelled fetch
      "ECONNRESET",         // upstream dropped
      "ETIMEDOUT",          // upstream slow
    ],

    beforeSend(event) {
      if (process.env.NODE_ENV === "development") return null;
      return event;
    },
  });
}
