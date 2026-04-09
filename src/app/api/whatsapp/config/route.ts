import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getMetaConfig, setMetaConfig } from "@/lib/meta-whatsapp";

export async function GET() {
  const db = getDb();
  const config = getMetaConfig(db);
  // Don't expose secrets fully — mask them
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    safe[k] = v.length > 8 ? v.substring(0, 4) + "..." + v.substring(v.length - 4) : "****";
  }
  return NextResponse.json(safe);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string" && value.trim()) {
      setMetaConfig(db, key, value.trim());
    }
  }
  return NextResponse.json({ status: "saved" });
}
