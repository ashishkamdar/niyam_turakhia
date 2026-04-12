import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/health
 *
 * Lightweight health check for monitoring tools (UptimeRobot, Pingdom,
 * AWS ALB, etc.). Returns 200 if the app is alive and the database is
 * accessible. No auth required — monitoring tools can't log in.
 *
 * Response time target: < 10ms.
 */
export async function GET() {
  const start = Date.now();
  let dbOk = false;
  let schemaVersion = 0;

  try {
    const db = getDb();
    const row = db
      .prepare("SELECT MAX(version) as v FROM schema_version")
      .get() as { v: number } | undefined;
    schemaVersion = row?.v ?? 0;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const uptimeSeconds = Math.floor(process.uptime());
  const memoryMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const responseMs = Date.now() - start;

  const status = dbOk ? "ok" : "degraded";
  const httpStatus = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      version: "1.0.0",
      schema_version: schemaVersion,
      uptime_seconds: uptimeSeconds,
      uptime_human: formatUptime(uptimeSeconds),
      memory_mb: memoryMB,
      response_ms: responseMs,
      db_ok: dbOk,
      timestamp: new Date().toISOString(),
    },
    { status: httpStatus }
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
