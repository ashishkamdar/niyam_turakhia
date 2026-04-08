import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedSampleData } from "@/lib/sample-data";
import { v4 as uuid } from "uuid";

const OPENING_STOCK = [
  { metal: "gold", price_per_oz: 2320.0000, qty: 50000, seller: "Al Maktoum Gold Trading" },
  { metal: "silver", price_per_oz: 29.50, qty: 50000, seller: "Dubai Silver Souk LLC" },
  { metal: "platinum", price_per_oz: 965.00, qty: 50000, seller: "Gulf Platinum Refinery" },
  { metal: "palladium", price_per_oz: 1005.00, qty: 50000, seller: "Arabian Metals Group" },
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
    // Seed prices only — zero positions, zero deals
    const { seedDemoPrices } = await import("@/lib/prices");
    seedDemoPrices();
    return NextResponse.json({ status: "reset" });
  }
  if (action === "reset-demo") {
    // Clear WhatsApp data and WhatsApp-created deals + payments
    db.prepare("DELETE FROM whatsapp_messages").run();
    db.prepare("DELETE FROM settlements").run();
    db.prepare("DELETE FROM payments WHERE linked_deal_id IN (SELECT id FROM deals WHERE created_by = 'whatsapp')").run();
    db.prepare("DELETE FROM deals WHERE created_by = 'whatsapp'").run();
    // Seed 50kg opening stock for each metal if no stock exists
    const stockCount = (db.prepare("SELECT COUNT(*) as c FROM deals WHERE direction = 'buy' AND status != 'sold'").get() as { c: number }).c;
    if (stockCount === 0) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString();
      const ins = db.prepare("INSERT INTO deals (id, metal, purity, is_pure, quantity_grams, pure_equivalent_grams, price_per_oz, refining_cost_per_gram, total_cost_usd, direction, location, status, date, created_by, contact_name) VALUES (?,?,?,1,?,?,?,0,0,'buy','uae','in_hk',?,'simulator',?)");
      for (const s of OPENING_STOCK) {
        ins.run(uuid(), s.metal, "24K", s.qty, s.qty, s.price_per_oz, dateStr, s.seller);
      }
    }
    return NextResponse.json({ status: "demo-reset" });
  }
  return NextResponse.json({ status: "ok" });
}
