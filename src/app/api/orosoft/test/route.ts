import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import {
  getOroSoftConfig,
  getOroSoftToken,
  fetchAccountsList,
  fetchFixingStocks,
  fetchLocations,
} from "@/lib/orosoft-client";

/**
 * GET /api/orosoft/test
 *
 * Tests OroSoft NeoConnect connectivity:
 *   1. Reads config from settings
 *   2. Authenticates (generates token)
 *   3. Fetches AccountsList, FixingStocks, Locations
 *
 * Returns a summary so the admin can verify the integration works.
 */
export async function GET(req: NextRequest) {
  const actor = getCurrentUser(req);
  if (!actor || (actor.role !== "super_admin" && actor.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const db = getDb();
  const config = getOroSoftConfig(db);
  if (!config) {
    return NextResponse.json({
      ok: false,
      error: "OroSoft NeoConnect not configured. Check settings.",
    });
  }

  // Auth
  const authResult = await getOroSoftToken(config);
  if (!authResult.ok) {
    return NextResponse.json({
      ok: false,
      error: `Authentication failed: ${authResult.error}`,
    });
  }

  // Fetch master data in parallel
  const [accountsResult, stocksResult, locationsResult] = await Promise.all([
    fetchAccountsList(config, authResult.token),
    fetchFixingStocks(config, authResult.token),
    fetchLocations(config, authResult.token),
  ]);

  const customers = accountsResult.ok
    ? accountsResult.data.filter((a) => a.accountType === "C")
    : [];
  const suppliers = accountsResult.ok
    ? accountsResult.data.filter((a) => a.accountType === "S")
    : [];

  return NextResponse.json({
    ok: true,
    enabled: config.enabled,
    auth: "success",
    accounts: accountsResult.ok
      ? {
          total: accountsResult.data.length,
          customers: customers.length,
          suppliers: suppliers.length,
          customer_list: customers.map((a) => ({
            code: a.accountCode,
            name: a.accountName,
            active: a.isActive === 1,
          })),
        }
      : { error: accountsResult.error },
    fixing_stocks: stocksResult.ok
      ? stocksResult.data.map((s) => ({
          commodity: s.commodity,
          stockCode: s.stockCode,
          convFactor: s.convFactor,
        }))
      : { error: stocksResult.error },
    locations: locationsResult.ok
      ? locationsResult.data
      : { error: locationsResult.error },
  });
}
