/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: false,
    instrumentationHook: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sentry wrapper
// ─────────────────────────────────────────────────────────────────────────────
// withSentryConfig wraps the Next config and injects Sentry's webpack plugin
// for source map upload + automatic instrumentation.
//
// If SENTRY_AUTH_TOKEN is unset, source map upload is silently skipped —
// errors will still be captured, just with minified stack traces.
const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(nextConfig, {
  // Sentry org / project — set via env so we don't hard-code identifiers
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Suppress build logs (Sentry's default output is noisy on Vercel)
  silent: !process.env.CI,

  // Don't error the build if Sentry is not configured (dev / preview)
  errorOnMissingDsn: false,

  // Upload source maps in CI only — requires SENTRY_AUTH_TOKEN
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring", // proxy events through our domain (avoids ad-blockers)
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
