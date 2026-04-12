import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/parties/sync?target=sbs|orosoft
 *
 * Stub endpoints for pulling party master data from the downstream
 * accounting systems. The software vendors (SBS and OroSoft) will
 * provide REST API documentation; until then these stubs return a
 * clear "not yet configured" response so the UI can show the sync
 * buttons with an honest status.
 *
 * When the real APIs are available, this handler will:
 *   1. Read connection credentials from settings/meta_config
 *   2. Fetch the party list from the vendor endpoint
 *   3. Upsert into the parties table (matching on vendor party code)
 *   4. Return { ok, synced: N, created: N, updated: N }
 *
 * The stub shape matches the future success shape so the UI doesn't
 * need to change when the real implementation lands.
 */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("target");

  if (target !== "sbs" && target !== "orosoft") {
    return NextResponse.json(
      { ok: false, error: "target must be 'sbs' or 'orosoft'" },
      { status: 400 }
    );
  }

  const label = target === "sbs" ? "SBS" : "OroSoft Neo";

  return NextResponse.json(
    {
      ok: false,
      stub: true,
      error: `${label} API integration is not yet configured. Once the vendor provides REST API credentials and documentation, this endpoint will pull the party master automatically.`,
      target,
      help: {
        what_this_will_do: `Connect to ${label}'s API, fetch the full party/buyer/seller master list, and upsert into PrismX's parties table — matching on ${target === "sbs" ? "sbs_party_code" : "orosoft_party_code"}.`,
        what_we_need_from_vendor: [
          "REST API base URL",
          "Authentication method (API key, OAuth, basic auth)",
          "Endpoint path for listing parties/buyers/sellers",
          "Response schema (field names for party code, name, type, contact details)",
        ],
        where_to_configure: "Once received, add the credentials in Settings → Data Source or contact the developer to wire the integration.",
      },
    },
    { status: 501 }
  );
}
