/**
 * Cloudflare Zero Trust Access – email list management.
 *
 * The Access Application covers nt.areakpi.in (the full domain). A single
 * reusable policy ("Authorized Staff") controls who can pass through:
 *   - decision: "allow"  → only listed emails pass (email OTP)
 *   - decision: "bypass" → everyone passes, no OTP
 *
 * Credentials are stored in the `settings` KV table (never in code):
 *   cloudflare_api_token, cloudflare_account_id,
 *   cloudflare_access_app_id, cloudflare_access_policy_id
 */

import type Database from "better-sqlite3";

type CfConfig = {
  token: string;
  accountId: string;
  policyId: string;
};

function getCfConfig(db: Database.Database): CfConfig | null {
  const get = (key: string) =>
    (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value;

  const token = get("cloudflare_api_token");
  const accountId = get("cloudflare_account_id");
  const policyId = get("cloudflare_access_policy_id");

  if (!token || !accountId || !policyId) return null;
  return { token, accountId, policyId };
}

function policyUrl(cfg: CfConfig): string {
  return `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/access/policies/${cfg.policyId}`;
}

function headers(cfg: CfConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.token}`,
    "Content-Type": "application/json",
  };
}

// ── Read ────────────────────────────────────────────────────────────

export type PolicyState = {
  enforced: boolean;       // true = allow (email OTP), false = bypass
  emails: string[];        // list of allowed emails (only meaningful when enforced)
};

export async function getAccessPolicy(db: Database.Database): Promise<PolicyState | null> {
  const cfg = getCfConfig(db);
  if (!cfg) return null;

  const res = await fetch(policyUrl(cfg), { headers: headers(cfg) });
  const data = await res.json();
  if (!data.success) return null;

  const policy = data.result;
  const enforced = policy.decision === "allow";
  const emails: string[] = [];

  for (const rule of policy.include || []) {
    if (rule.email?.email) emails.push(rule.email.email);
  }

  return { enforced, emails };
}

// ── Toggle enforce / bypass ─────────────────────────────────────────

export async function setAccessEnforced(
  db: Database.Database,
  enforced: boolean,
  emails: string[]
): Promise<{ ok: boolean; error?: string }> {
  const cfg = getCfConfig(db);
  if (!cfg) return { ok: false, error: "Cloudflare Access not configured" };

  const body = enforced
    ? {
        name: "Authorized Staff",
        decision: "allow",
        include: emails.map((e) => ({ email: { email: e } })),
      }
    : {
        name: "Authorized Staff",
        decision: "bypass",
        include: [{ everyone: {} }],
      };

  const res = await fetch(policyUrl(cfg), {
    method: "PUT",
    headers: headers(cfg),
    body: JSON.stringify(body),
  });
  const data = await res.json();

  if (!data.success) {
    return { ok: false, error: data.errors?.[0]?.message || "Cloudflare API error" };
  }
  return { ok: true };
}

// ── Add / remove a single email ─────────────────────────────────────

export async function addAccessEmail(
  db: Database.Database,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const state = await getAccessPolicy(db);
  if (!state) return { ok: false, error: "Cloudflare Access not configured" };
  if (!state.enforced) return { ok: true }; // bypass mode — nothing to do

  const lower = email.toLowerCase();
  if (state.emails.some((e) => e.toLowerCase() === lower)) return { ok: true }; // already present

  return setAccessEnforced(db, true, [...state.emails, email]);
}

export async function removeAccessEmail(
  db: Database.Database,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const state = await getAccessPolicy(db);
  if (!state) return { ok: false, error: "Cloudflare Access not configured" };
  if (!state.enforced) return { ok: true }; // bypass mode — nothing to do

  const lower = email.toLowerCase();
  const filtered = state.emails.filter((e) => e.toLowerCase() !== lower);
  if (filtered.length === state.emails.length) return { ok: true }; // wasn't there

  return setAccessEnforced(db, true, filtered);
}
