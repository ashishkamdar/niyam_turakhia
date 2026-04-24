import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import {
  getOroSoftConfig,
  getOroSoftToken,
  fetchAccountsList,
} from "@/lib/orosoft-client";

/**
 * GET /api/orosoft/balances
 *
 * Fetches stock balances (all commodities) and account balances
 * (all customers) from OroSoft NeoConnect in one call.
 */
export async function GET(req: NextRequest) {
  const actor = getCurrentUser(req);
  if (!actor || (actor.role !== "super_admin" && actor.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }

  const db = getDb();
  const config = getOroSoftConfig(db);
  if (!config) {
    return NextResponse.json({ ok: false, error: "OroSoft not configured" });
  }

  const authResult = await getOroSoftToken(config);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, error: authResult.error });
  }
  const token = authResult.token;
  const headers = {
    Authorization: `Bearer ${token}`,
    CompanyCode: config.companyCode,
  };

  const today = new Date();
  const asOnDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  // Fetch stock balances for all commodities + customer account balances in parallel
  const commodities = ["XAU", "XAG", "XPT", "XPD"];

  const [stockResults, accountsResult] = await Promise.all([
    Promise.all(
      commodities.map(async (commodity) => {
        try {
          const res = await fetch(
            `${config.baseUrl}/v1_2/api/reports/StockBalances?commodity=${commodity}&groupByLocation=0`,
            { headers }
          );
          const data = await res.json();
          return { commodity, balances: data.result?.stockBalances ?? [] };
        } catch {
          return { commodity, balances: [] };
        }
      })
    ),
    fetchAccountsList(config, token),
  ]);

  // Fetch account balances for all customers
  const customers = accountsResult.ok
    ? accountsResult.data.filter((a) => a.accountType === "C" && a.isActive === 1)
    : [];

  const accountBalances = await Promise.all(
    customers.slice(0, 20).map(async (customer) => {
      try {
        const res = await fetch(
          `${config.baseUrl}/v1_2/api/reports/AccountBalances?accountCode=${customer.accountCode}&asOnDate=${asOnDate}`,
          { headers }
        );
        const data = await res.json();
        return {
          accountCode: customer.accountCode,
          accountName: customer.accountName,
          balances: data.result?.accountBalances ?? [],
        };
      } catch {
        return {
          accountCode: customer.accountCode,
          accountName: customer.accountName,
          balances: [],
        };
      }
    })
  );

  // Filter out customers with zero balances
  const nonZeroAccounts = accountBalances.filter((a) =>
    a.balances.some((b: { balance: number }) => b.balance !== 0)
  );

  return NextResponse.json({
    ok: true,
    asOnDate,
    stockBalances: stockResults.filter((s) => s.balances.length > 0),
    accountBalances: nonZeroAccounts,
  });
}
