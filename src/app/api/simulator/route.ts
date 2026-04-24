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
    // Clear ALL trade data for go-live cleanup.
    // Keeps: prices, parties, auth (pins/sessions), settings (credentials), meta_config.
    const tables = [
      "pending_deals",     // main trade pipeline (review → approve → dispatch)
      "dispatch_log",      // OroSoft/SBS sync history + doc numbers
      "audit_log",         // audit trail of test actions
      "notifications",     // in-app notification feed
      "whatsapp_messages", // WhatsApp message log
      "deals",             // old demo deals
      "payments",          // demo payments
      "settlements",       // demo settlements
      "deliveries",        // demo deliveries
      "stock_opening",     // test opening stock register
      "parsed_deals",      // legacy bot parsed deals
    ];
    const txn = db.transaction(() => {
      for (const table of tables) {
        db.prepare(`DELETE FROM ${table}`).run();
      }
      // Clear stale dispatch lock
      db.prepare("DELETE FROM settings WHERE key = 'dispatch_lock'").run();
    });
    txn();
    return NextResponse.json({ status: "reset", cleared: tables });
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
