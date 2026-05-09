/**
 * Next.js instrumentation hook.
 *
 * Loaded once at server startup and once per edge worker boot.
 * We use it to register the right Sentry config based on which
 * runtime is starting.
 *
 * Reference: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forward errors thrown in `notFound()`, `error.tsx`, etc. to Sentry
export { captureRequestError as onRequestError } from "@sentry/nextjs";
