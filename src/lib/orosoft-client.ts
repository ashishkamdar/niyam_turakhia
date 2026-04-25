/**
 * OroSoft NeoConnect API client.
 *
 * Handles authentication (JWT token with in-memory cache),
 * FixingTrade submission, and master data queries.
 *
 * Credentials are stored in the `settings` KV table — never in code.
 */

import type Database from "better-sqlite3";

// ── Config ──────────────────────────────────────────────────────────

export type OroSoftConfig = {
  authUrl: string;
  baseUrl: string;
  username: string;
  password: string;
  companyCode: string;
  enabled: boolean;
};

export function getOroSoftConfig(db: Database.Database): OroSoftConfig | null {
  const get = (key: string) =>
    (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value;

  const authUrl = get("orosoft_auth_url");
  const baseUrl = get("orosoft_base_url");
  const username = get("orosoft_username");
  const password = get("orosoft_password");
  const companyCode = get("orosoft_company_code") ?? "default";
  const enabled = get("orosoft_enabled") === "true";

  if (!authUrl || !baseUrl || !username || !password) return null;
  return { authUrl, baseUrl, username, password, companyCode, enabled };
}

// ── Token cache ─────────────────────────────────────────────────────

let _cachedToken: { token: string; expiresAt: number } | null = null;
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 minutes (JWT likely 1hr)

export function invalidateToken(): void {
  _cachedToken = null;
}

export async function getOroSoftToken(
  config: OroSoftConfig
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt) {
    return { ok: true, token: _cachedToken.token };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(config.authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: config.username, password: config.password }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Auth failed (${res.status}): ${body}` };
    }

    const data = await res.json();
    if (!data.token) {
      return { ok: false, error: "Auth response missing token field" };
    }

    _cachedToken = { token: data.token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return { ok: true, token: data.token };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Auth network error: ${msg}` };
  }
}

// ── Generic fetcher ─────────────────────────────────────────────────

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; httpStatus: number | null };

async function oroFetch<T>(
  config: OroSoftConfig,
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResult<T>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const url = `${config.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        CompanyCode: config.companyCode,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }

    if (!res.ok) {
      const errMsg = typeof json === "object" && json !== null && "message" in json
        ? (json as { message: string }).message
        : text;
      return { ok: false, error: `OroSoft ${res.status}: ${errMsg}`, httpStatus: res.status };
    }

    return { ok: true, data: json as T };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Network error: ${msg}`, httpStatus: null };
  }
}

// ── FixingTrade ─────────────────────────────────────────────────────

// Field order matches OroSoft FixingTradeRequest spec
export type FixingTradePayload = {
  documentType?: string;    // "FCT" | "FBT" (default FCT)
  docDate?: string;         // YYYYMMDD
  accountCode: string;
  valueDate?: string;       // YYYYMMDD
  referenceNo?: string;
  cmdtyPair: string;        // e.g. "XAUUSD"
  deal: number;             // 1=BUY, 0=SELL
  piecesQty: number;        // max 3 decimals
  stockCode: string;        // e.g. "OZ", "GMS", "KG4X9", "KG995", "LBS"
  price: number;            // max 7 decimals
  priceType?: string;       // "OZ" | "GMS" | "KG" (default OZ)
  prmRateType?: string;     // "OZ" | "GMS" | "KG"
  prmRate?: number;
  location?: string;
  salesman?: string;
  remarks?: string;
};

export type FixingTradeResult = {
  docNumber: string;
};

export async function submitFixingTrade(
  config: OroSoftConfig,
  token: string,
  payload: FixingTradePayload
): Promise<ApiResult<FixingTradeResult>> {
  const result = await oroFetch<string | { exid?: string }>(
    config,
    token,
    "POST",
    "/v1_2/api/document/FixingTrade",
    payload
  );

  if (!result.ok) return result;

  // OroSoft returns: {"result":{"EXID":"FCT/2026/000012"}}
  const d = result.data as Record<string, unknown>;
  let docNumber: string;
  if (typeof d === "object" && d !== null) {
    const inner = (d.result ?? d) as Record<string, unknown>;
    docNumber = (inner.EXID ?? inner.exid ?? inner.Exid ?? JSON.stringify(d)) as string;
  } else {
    docNumber = String(d);
  }

  return { ok: true, data: { docNumber } };
}

// ── Master data ─────────────────────────────────────────────────────

export type OroSoftAccount = {
  accountType: string;  // C=Customer, S=Supplier, B=Bank, G=General
  accountCode: string;
  accountName: string;
  isActive: number;
};

export async function fetchAccountsList(
  config: OroSoftConfig,
  token: string
): Promise<ApiResult<OroSoftAccount[]>> {
  const result = await oroFetch<{ result: OroSoftAccount[] } | OroSoftAccount[]>(
    config,
    token,
    "GET",
    "/v1_2/api/details/AccountsList"
  );
  if (!result.ok) return result;
  const accounts = Array.isArray(result.data) ? result.data : result.data.result ?? [];
  return { ok: true, data: accounts };
}

export type OroSoftFixingStock = {
  commodity: string;   // XAU, XAG, XPT, XPD
  stockCode: string;   // "OZ", "GMS", "KG 4X9", "KG 995", "TTB", "KG", "LBS"
  convFactor: number;  // conversion factor to OZ
};

export async function fetchFixingStocks(
  config: OroSoftConfig,
  token: string
): Promise<ApiResult<OroSoftFixingStock[]>> {
  const result = await oroFetch<{ result: OroSoftFixingStock[] } | OroSoftFixingStock[]>(
    config,
    token,
    "GET",
    "/v1_2/api/details/FixingStocks"
  );
  if (!result.ok) return result;
  const stocks = Array.isArray(result.data) ? result.data : result.data.result ?? [];
  return { ok: true, data: stocks };
}

export type OroSoftLocation = {
  locationCode: string;
  locationName: string;
};

export async function fetchLocations(
  config: OroSoftConfig,
  token: string
): Promise<ApiResult<OroSoftLocation[]>> {
  const result = await oroFetch<{ result: OroSoftLocation[] } | OroSoftLocation[]>(
    config,
    token,
    "GET",
    "/v1_2/api/details/Locations"
  );
  if (!result.ok) return result;
  const locations = Array.isArray(result.data) ? result.data : result.data.result ?? [];
  return { ok: true, data: locations };
}
