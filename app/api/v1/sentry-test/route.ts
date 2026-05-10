/**
 * Sentry verification endpoint — TEMPORARY (W2 Day 11 PM).
 *
 * REMOVE THIS FILE after verifying that errors flow into the Sentry
 * dashboard. The route is intentionally undocumented elsewhere.
 *
 * Usage:
 *   GET /api/v1/sentry-test           → throws (tests automatic capture via instrumentation)
 *   GET /api/v1/sentry-test?mode=throw    → same as default
 *   GET /api/v1/sentry-test?mode=capture  → uses Sentry.captureException explicitly
 *
 * After visiting either URL, check https://project-q-labs.sentry.io/issues
 * for a new issue. The error message includes a timestamp so we can match
 * the request to the captured event.
 *
 * Security note: this is a public endpoint until removed. It only triggers
 * a Sentry event — no data leak, no state change. Still, remove it ASAP
 * after verification.
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

class SentryVerificationError extends Error {
  constructor(mode: string, ts: string) {
    super(`Sentry verification (${mode}) at ${ts}`);
    this.name = "SentryVerificationError";
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "throw";
  const ts = new Date().toISOString();

  if (mode === "capture") {
    // Path 1: explicit capture. Returns 200 even though we report an error.
    // Useful when you need to verify Sentry connectivity without breaking
    // the response.
    Sentry.captureException(new SentryVerificationError("capture", ts));
    return NextResponse.json({
      mode: "capture",
      message: "Sent to Sentry via captureException. Check the dashboard.",
      timestamp: ts,
    });
  }

  // Path 2 (default): unhandled throw. Tests that instrumentation.ts is
  // wired correctly and Sentry's automatic Next.js integration captures
  // server errors. Returns 500 to the client.
  throw new SentryVerificationError("throw", ts);
}
