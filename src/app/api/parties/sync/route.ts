import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import {
  getOroSoftConfig,
  getOroSoftToken,
  fetchAccountsList,
} from "@/lib/orosoft-client";

/**
 * GET /api/parties/sync?target=sbs|orosoft
 *
 * For OroSoft: fetches AccountsList from NeoConnect, upserts into
 * parties table matching on orosoft_party_code. Creates new parties
 * for accounts not yet in PrismX.
 *
 * SBS remains a stub until their API is available.
 */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("target");

  if (target !== "sbs" && target !== "orosoft") {
    return NextResponse.json(
      { ok: false, error: "target must be 'sbs' or 'orosoft'" },
      { status: 400 }
    );
  }

  const actor = getCurrentUser(req);
  if (!actor || (actor.role !== "super_admin" && actor.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  // ── SBS stub ────────────────────────────────────────────────────
  if (target === "sbs") {
    return NextResponse.json(
      {
        ok: false,
        stub: true,
        error: "SBS API integration is not yet configured.",
        target,
      },
      { status: 501 }
    );
  }

  // ── OroSoft real sync ───────────────────────────────────────────
  const db = getDb();
  const config = getOroSoftConfig(db);
  if (!config) {
    return NextResponse.json({
      ok: false,
      error: "OroSoft NeoConnect not configured. Check settings.",
    });
  }

  const authResult = await getOroSoftToken(config);
  if (!authResult.ok) {
    return NextResponse.json({
      ok: false,
      error: `Authentication failed: ${authResult.error}`,
    });
  }

  const accountsResult = await fetchAccountsList(config, authResult.token);
  if (!accountsResult.ok) {
    return NextResponse.json({
      ok: false,
      error: `Failed to fetch accounts: ${accountsResult.error}`,
    });
  }

  // Only sync Customer (C) and Supplier (S) accounts — skip
  // General ledger (G) and Bank (B) accounts.
  const tradingAccounts = accountsResult.data.filter(
    (a) => a.accountType === "C" || a.accountType === "S"
  );

  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const upsert = db.transaction(() => {
    for (const acct of tradingAccounts) {
      // Check if party already exists by orosoft_party_code
      const existing = db.prepare(
        "SELECT id, name FROM parties WHERE orosoft_party_code = ?"
      ).get(acct.accountCode) as { id: string; name: string } | undefined;

      if (existing) {
        // Update name if changed
        if (existing.name !== acct.accountName) {
          db.prepare(
            "UPDATE parties SET name = ?, updated_at = ? WHERE id = ?"
          ).run(acct.accountName, now, existing.id);
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Create new party
        const partyType = acct.accountType === "C" ? "customer"
          : acct.accountType === "S" ? "supplier"
          : "both";

        db.prepare(
          `INSERT INTO parties (id, name, short_code, type, orosoft_party_code, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
        ).run(
          randomUUID(),
          acct.accountName,
          acct.accountCode,  // use OroSoft code as short_code for easy reference
          partyType,
          acct.accountCode,
          now,
          now
        );
        created++;
      }
    }
  });
  upsert();

  return NextResponse.json({
    ok: true,
    target: "orosoft",
    total_fetched: tradingAccounts.length,
    created,
    updated,
    skipped,
  });
}
