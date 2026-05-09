/**
 * Sentry — Browser config
 *
 * Captures runtime errors in the user's browser. Initialized once when
 * the page first loads.
 *
 * If NEXT_PUBLIC_SENTRY_DSN is empty or absent, Sentry stays dormant —
 * useful for local dev without spamming the dashboard.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Performance monitoring — sample 10% of traces (free-tier friendly)
    tracesSampleRate: 0.1,

    // Session replay — disabled to keep events under the 5K/mo cap
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Ignore browser-side noise that isn't actionable
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed",
      "Network request failed",
      "Failed to fetch",
      "Load failed",
      // Ad-blocker noise
      /^TypeError: Cancelled$/,
    ],

    // Don't send errors from local development
    beforeSend(event) {
      if (process.env.NODE_ENV === "development") return null;
      return event;
    },
  });
}
