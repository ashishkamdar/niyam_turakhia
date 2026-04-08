import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedSampleData } from "@/lib/sample-data";
import { v4 as uuid } from "uuid";

const OPENING_STOCK = [
  { metal: "gold", price_per_oz: 2320.0000, qty: 50000 },
  { metal: "silver", price_per_oz: 29.50, qty: 50000 },
  { metal: "platinum", price_per_oz: 965.00, qty: 50000 },
  { metal: "palladium", price_per_oz: 1005.00, qty: 50000 },
];

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
    // Seed prices
    const { seedDemoPrices } = await import("@/lib/prices");
    seedDemoPrices();
    // Seed 50kg opening stock for each metal (bought yesterday at discount)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString();
    const ins = db.prepare("INSERT INTO deals (id, metal, purity, is_pure, quantity_grams, pure_equivalent_grams, price_per_oz, refining_cost_per_gram, total_cost_usd, direction, location, status, date, created_by, contact_name) VALUES (?,?,?,1,?,?,?,0,0,?,?,?,?,'simulator','Opening Stock')");
    for (const s of OPENING_STOCK) {
      ins.run(uuid(), s.metal, "24K", s.qty, s.qty, s.price_per_oz, "buy", "uae", "in_hk", dateStr);
    }
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
