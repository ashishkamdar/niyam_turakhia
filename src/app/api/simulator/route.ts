import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedSampleData } from "@/lib/sample-data";

export async function POST(req: NextRequest) {
  const { action } = await req.json();
  const db = getDb();
  if (action === "reset") {
    // Delete all rows using parameterised-safe prepare statements
    db.prepare("DELETE FROM payments").run();
    db.prepare("DELETE FROM deals").run();
    db.prepare("DELETE FROM prices").run();
    seedSampleData();
    return NextResponse.json({ status: "reset" });
  }
  return NextResponse.json({ status: "ok" });
}
