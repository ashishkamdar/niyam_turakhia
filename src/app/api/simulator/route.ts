import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedSampleData } from "@/lib/sample-data";

export async function POST(req: NextRequest) {
  const { action } = await req.json();
  const db = getDb();
  if (action === "reset") {
    db.prepare("DELETE FROM whatsapp_messages").run();
    db.prepare("DELETE FROM settlements").run();
    db.prepare("DELETE FROM deliveries").run();
    db.prepare("DELETE FROM payments").run();
    db.prepare("DELETE FROM deals").run();
    db.prepare("DELETE FROM prices").run();
    seedSampleData();
    return NextResponse.json({ status: "reset" });
  }
  if (action === "reset-demo") {
    // Only clear WhatsApp data and WhatsApp-created deals — keep sample data
    db.prepare("DELETE FROM whatsapp_messages").run();
    db.prepare("DELETE FROM deals WHERE created_by = 'whatsapp'").run();
    return NextResponse.json({ status: "demo-reset" });
  }
  return NextResponse.json({ status: "ok" });
}
