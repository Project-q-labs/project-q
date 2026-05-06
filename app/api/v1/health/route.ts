import { NextResponse } from "next/server";

/**
 * GET /api/v1/health
 *
 * Service health check. Returns operational status, version, and timestamp.
 * Used by uptime monitors and to verify deployment.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "project-q",
    version: "0.1.0",
    environment: process.env.NODE_ENV ?? "unknown",
    timestamp: new Date().toISOString(),
  });
}
