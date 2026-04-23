"use client";

/**
 * /users — "Currently Logged In" dashboard for Niyam.
 *
 * Shows a live list of sessions (auto-polls every 5s), grouped by
 * (PIN label, IP) so when two people on the same office WiFi share the
 * "Staff" PIN, we can see both of their sessions with a count.
 *
 * Also exposes a collapsible "Manage PINs" panel where admins can
 * add / rename / rotate / delete PINs — all changes go through /api/pins.
 *
 * Print + Share buttons live at the top right and are hidden in the
 * printed output via `print:hidden`. Print output uses the shared
 * ReportLetterhead + globals.css @media print rules for consistent
 * letterhead styling with /reports.
 */

// Force dynamic so this page is never statically pre-rendered — the
// content is user-specific and changes every few seconds.
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { ReportLetterhead } from "@/components/report-letterhead";

type Session = {
  id: string;
  pin_id: string;
  label: string;
  role: string;
  ip: string;
  user_agent: string;
  country: string | null;
  created_at: string;
  last_seen: string;
  is_active: boolean;
};

/** Convert 2-letter ISO country code to flag emoji + name. */
function countryLabel(code: string | null): string {
  if (!code || code === "XX" || code === "T1") return "";
  // Flag emoji: regional indicator symbols
  const flag = [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
  // Common country names for bullion trading regions
  const names: Record<string, string> = {
    HK: "Hong Kong", CN: "China", IN: "India", AE: "UAE", SG: "Singapore",
    US: "United States", GB: "United Kingdom", JP: "Japan", AU: "Australia",
    CH: "Switzerland", DE: "Germany", SA: "Saudi Arabia", QA: "Qatar",
    KW: "Kuwait", BH: "Bahrain", OM: "Oman", MY: "Malaysia", TH: "Thailand",
    ID: "Indonesia", PH: "Philippines", VN: "Vietnam", KR: "South Korea",
    TW: "Taiwan", BD: "Bangladesh", PK: "Pakistan", LK: "Sri Lanka",
    NP: "Nepal", MM: "Myanmar", KH: "Cambodia", LA: "Laos",
  };
  return `${flag} ${names[code.toUpperCase()] || code.toUpperCase()}`;
}

type Role = "super_admin" | "admin" | "staff" | "trade_desk";

type Pin = {
  id: string;
  label: string;
  pin: string;
  role: Role;
  locked: boolean;
  email: string | null;
  created_at: string;
  active_sessions: number;
};

/**
 * Normalize whatever the API returns into the strict Role union. Any
 * unknown value falls back to "staff" (least privilege) — matches the
 * server-side normalizeRole in lib/auth-context.ts.
 */
function coerceRole(raw: string | null | undefined): Role {
  if (raw === "super_admin") return "super_admin";
  if (raw === "admin") return "admin";
  if (raw === "trade_desk") return "trade_desk";
  return "staff";
}

// Role permission helpers mirrored from lib/auth-context so the UI can
// pre-emptively disable controls the server would also reject. Server
// is still the source of truth — these helpers only decide what to show.
function canCreateRoleUi(actor: Role, target: Role): boolean {
  if (actor === "super_admin") return true;
  if (actor === "admin") return target === "admin" || target === "staff" || target === "trade_desk";
  return false;
}
function canModifyPinUi(actor: Role, target: Role): boolean {
  if (actor === "super_admin") return true;
  if (actor === "admin") return target === "admin" || target === "staff" || target === "trade_desk";
  return false;
}

// Role display labels + pill colors. Super admin gets a violet accent
// so it stands out against the existing amber/gray roles without
// clashing with any business metric colour (emerald, rose, amber).
const ROLE_META: Record<Role, { label: string; pillClass: string }> = {
  super_admin: {
    label: "Super Admin",
    pillClass: "bg-violet-500/15 text-violet-300",
  },
  admin: {
    label: "Admin",
    pillClass: "bg-amber-500/15 text-amber-300",
  },
  staff: {
    label: "Staff",
    pillClass: "bg-gray-500/20 text-gray-400",
  },
  trade_desk: {
    label: "Trade Desk",
    pillClass: "bg-sky-500/15 text-sky-300",
  },
};

/**
 * Turn a raw user-agent string into a short, readable device/browser label.
 * Good enough for demo purposes — not a full UA parser. Ordered from
 * most-specific to least-specific so e.g. iPad matches before "Mac OS X".
 */
function shortenUA(ua: string): string {
  if (!ua) return "Unknown device";
  if (/iPhone/i.test(ua)) return "iPhone · Safari";
  if (/iPad/i.test(ua)) return "iPad · Safari";
  if (/Android/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Android · Chrome";
    return "Android";
  }
  if (/Macintosh|Mac OS X/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Mac · Chrome";
    if (/Firefox/i.test(ua)) return "Mac · Firefox";
    if (/Safari/i.test(ua)) return "Mac · Safari";
    return "Mac";
  }
  if (/Windows/i.test(ua)) {
    if (/Edg/i.test(ua)) return "Windows · Edge";
    if (/Chrome/i.test(ua)) return "Windows · Chrome";
    if (/Firefox/i.test(ua)) return "Windows · Firefox";
    return "Windows";
  }
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown device";
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const secs = Math.max(0, Math.floor((now - then) / 1000));
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function UsersPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [managePinsOpen, setManagePinsOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");

  // Current user's role drives what buttons are enabled and which
  // role options show in the add/edit dropdowns. Server is still the
  // source of truth — this is only for optimistic UI gating.
  const [currentRole, setCurrentRole] = useState<Role>("staff");
  const [cfEnforced, setCfEnforced] = useState(false);
  const [cfConfigured, setCfConfigured] = useState(false);
  const [cfToggling, setCfToggling] = useState(false);

  const loadCfStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/cloudflare-access");
      const json = await res.json();
      if (json.ok) {
        setCfConfigured(json.configured);
        setCfEnforced(json.enforced);
      }
    } catch {}
  }, []);

  const load = useCallback(async () => {
    try {
      const [sRes, pRes, meRes] = await Promise.all([
        fetch("/api/sessions"),
        fetch("/api/pins"),
        fetch("/api/auth"),
      ]);
      const sJson = await sRes.json();
      const pJson = await pRes.json();
      const meJson = await meRes.json();
      setSessions(sJson.sessions ?? []);
      setActiveCount(sJson.active_count ?? 0);
      setGeneratedAt(sJson.generated_at ?? "");
      // Coerce the raw API role strings to the strict Role union so
      // downstream consumers can rely on a narrow type.
      setPins(
        (pJson.pins ?? []).map((p: Pin & { role: string }) => ({
          ...p,
          role: coerceRole(p.role),
        }))
      );
      if (meJson?.authenticated) {
        setCurrentRole(coerceRole(meJson.role));
      }
    } catch {
      // Silent — just keep showing the last known state.
    }
  }, []);

  useEffect(() => {
    load();
    loadCfStatus();
    const poll = setInterval(load, 5000);
    return () => clearInterval(poll);
  }, [load, loadCfStatus]);

  // Group active sessions by (label, ip) so when multiple staff log in
  // with the same PIN from the same office WiFi, we collapse them into
  // one row with a count. Sorted by last_seen so the most recent activity
  // bubbles to the top.
  const activeSessions = sessions.filter((s) => s.is_active);
  const groupedActive = new Map<
    string,
    {
      label: string;
      role: string;
      ip: string;
      country: string | null;
      count: number;
      newestLastSeen: string;
      oldestCreatedAt: string;
      userAgents: string[];
    }
  >();
  for (const s of activeSessions) {
    const key = `${s.label}::${s.ip}`;
    const existing = groupedActive.get(key);
    if (existing) {
      existing.count += 1;
      if (s.last_seen > existing.newestLastSeen) existing.newestLastSeen = s.last_seen;
      if (s.created_at < existing.oldestCreatedAt) existing.oldestCreatedAt = s.created_at;
      if (!existing.userAgents.includes(shortenUA(s.user_agent))) {
        existing.userAgents.push(shortenUA(s.user_agent));
      }
    } else {
      groupedActive.set(key, {
        label: s.label,
        role: s.role,
        ip: s.ip,
        country: s.country,
        count: 1,
        newestLastSeen: s.last_seen,
        oldestCreatedAt: s.created_at,
        userAgents: [shortenUA(s.user_agent)],
      });
    }
  }
  const activeGroups = Array.from(groupedActive.values()).sort((a, b) =>
    b.newestLastSeen.localeCompare(a.newestLastSeen)
  );

  // Recent = everything that isn't currently active (last 24h, already
  // trimmed by the API sweep).
  const recentSessions = sessions.filter((s) => !s.is_active);

  async function kickGroup(label: string, ip: string, count: number) {
    if (!confirm(`Force logout ${count} session${count === 1 ? "" : "s"} for ${label} at ${ip}?`)) return;
    try {
      await fetch(
        `/api/sessions?label=${encodeURIComponent(label)}&ip=${encodeURIComponent(ip)}`,
        { method: "DELETE" }
      );
      load();
    } catch {
      // Silent — next poll will reflect whatever actually happened.
    }
  }

  async function kickSession(id: string, label: string) {
    if (!confirm(`Revoke this session for ${label}?`)) return;
    try {
      await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      load();
    } catch {
      // Silent — next poll will reflect whatever actually happened.
    }
  }

  async function handleShare() {
    const lines = [
      "PrismX — Currently Logged In Users",
      `As of ${formatTime(generatedAt || new Date().toISOString())}`,
      `${activeCount} active session${activeCount === 1 ? "" : "s"}`,
      "",
      ...activeGroups.map(
        (g) =>
          `• ${g.label} (${g.role}) · ${g.ip} · ${g.count} session${g.count === 1 ? "" : "s"} · ${g.userAgents.join(", ")}`
      ),
    ];
    const text = lines.join("\n");
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "PrismX Users", text });
        setShareFeedback("Shared");
        setTimeout(() => setShareFeedback(""), 2000);
        return;
      } catch {
        // User cancelled the native share sheet — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareFeedback("Copied to clipboard");
      setTimeout(() => setShareFeedback(""), 2000);
    } catch {
      setShareFeedback("Unable to share");
      setTimeout(() => setShareFeedback(""), 2000);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6 overflow-x-hidden">
      <ReportLetterhead
        title="Currently Logged In Users"
        subtitle={`${activeCount} active session${activeCount === 1 ? "" : "s"}${generatedAt ? ` · updated ${timeAgo(generatedAt)}` : ""}`}
      />

      {/* Action bar — hidden in print */}
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        {shareFeedback && (
          <span className="text-xs text-emerald-400">{shareFeedback}</span>
        )}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-md border border-white/10 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/5"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          Share
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
          </svg>
          Print / PDF
        </button>
      </div>

      {/* Cloudflare Access toggle — admin/super_admin only */}
      {(currentRole === "super_admin" || currentRole === "admin") && cfConfigured && (
        <section className="print:hidden">
          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-gray-900 px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                Cloudflare Access
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                  cfEnforced
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-gray-500/20 text-gray-400"
                }`}>
                  {cfEnforced ? "Enforced" : "Bypassed"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {cfEnforced
                  ? "Email OTP required — only users with emails can access the site"
                  : "Bypassed — anyone can access, only PIN login protects the app"}
              </p>
            </div>
            <button
              onClick={async () => {
                setCfToggling(true);
                try {
                  const res = await fetch("/api/cloudflare-access", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enforced: !cfEnforced }),
                  });
                  const json = await res.json();
                  if (json.ok) {
                    setCfEnforced(json.enforced ?? !cfEnforced);
                  } else {
                    alert(json.error || "Failed to toggle");
                  }
                } catch {
                  alert("Network error");
                } finally {
                  setCfToggling(false);
                }
              }}
              disabled={cfToggling}
              className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                cfEnforced ? "bg-emerald-600" : "bg-gray-600"
              } ${cfToggling ? "opacity-50" : ""}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  cfEnforced ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </section>
      )}

      {/* Active sessions section */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white print:text-black">
          <span className="inline-block size-2 animate-pulse rounded-full bg-emerald-500 print:hidden" />
          Active Now
          <span className="text-xs font-normal text-gray-500 print:text-gray-600">
            · last activity within 2 minutes
          </span>
        </h2>
        {activeGroups.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-gray-900 p-6 text-center text-sm text-gray-500 print:border-gray-300 print:bg-gray-50 print:text-gray-600">
            No one is currently logged in.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/5 bg-gray-900 print:border-gray-300 print:bg-gray-50">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400 print:bg-gray-100 print:text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">User</th>
                  <th className="px-4 py-2 text-left font-semibold">IP Address</th>
                  <th className="px-4 py-2 text-left font-semibold">Sessions</th>
                  <th className="px-4 py-2 text-left font-semibold">Device</th>
                  <th className="px-4 py-2 text-left font-semibold">Logged in</th>
                  <th className="px-4 py-2 text-left font-semibold">Last active</th>
                  <th className="px-4 py-2 text-right font-semibold print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 print:divide-gray-200">
                {activeGroups.map((g) => {
                  const groupRole = coerceRole(g.role);
                  const roleMeta = ROLE_META[groupRole];
                  // An admin cannot kick a super_admin session. The
                  // server also enforces this — the UI disable is the
                  // first line of defense.
                  const canKick = canModifyPinUi(currentRole, groupRole);
                  return (
                    <tr key={`${g.label}-${g.ip}`}>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white print:text-black">
                            {g.label}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${roleMeta.pillClass}`}
                          >
                            {roleMeta.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-mono text-xs text-gray-300 print:text-gray-700">{g.ip}</div>
                        {g.country && (
                          <div className="mt-0.5 text-[10px] text-gray-500">{countryLabel(g.country)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            g.count > 1
                              ? "bg-rose-500/10 text-rose-300 print:bg-rose-100 print:text-rose-800"
                              : "bg-emerald-500/10 text-emerald-300 print:bg-emerald-100 print:text-emerald-800"
                          }`}
                        >
                          {g.count}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-gray-400 print:text-gray-600">
                        {g.userAgents.join(" + ")}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-gray-400 print:text-gray-600">
                        {formatTime(g.oldestCreatedAt)}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-emerald-400 print:text-emerald-700">
                        {timeAgo(g.newestLastSeen)}
                      </td>
                      <td className="px-4 py-3 align-top text-right print:hidden">
                        <button
                          onClick={() => canKick && kickGroup(g.label, g.ip, g.count)}
                          disabled={!canKick}
                          title={canKick ? undefined : "Only a Super Admin can kick a Super Admin"}
                          className={`rounded border px-2 py-1 text-[11px] font-semibold transition ${
                            canKick
                              ? "border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                              : "cursor-not-allowed border-white/5 text-gray-600"
                          }`}
                        >
                          {g.count > 1 ? `Kick all ${g.count}` : "Kick"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent history (last 24h) */}
      {recentSessions.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-white print:text-black">
            Recent Sessions
            <span className="ml-2 text-xs font-normal text-gray-500 print:text-gray-600">
              · last 24 hours
            </span>
          </h2>
          <div className="overflow-x-auto rounded-lg border border-white/5 bg-gray-900 print:border-gray-300 print:bg-gray-50">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400 print:bg-gray-100 print:text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">User</th>
                  <th className="px-4 py-2 text-left font-semibold">IP Address</th>
                  <th className="px-4 py-2 text-left font-semibold">Device</th>
                  <th className="px-4 py-2 text-left font-semibold">Logged in</th>
                  <th className="px-4 py-2 text-left font-semibold">Last active</th>
                  <th className="px-4 py-2 text-right font-semibold print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 print:divide-gray-200">
                {recentSessions.map((s) => {
                  const sessionRole = coerceRole(s.role);
                  const canRevoke = canModifyPinUi(currentRole, sessionRole);
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2 align-top font-semibold text-gray-300 print:text-gray-700">
                        {s.label}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <div className="font-mono text-xs text-gray-400 print:text-gray-600">{s.ip}</div>
                        {s.country && (
                          <div className="mt-0.5 text-[10px] text-gray-500">{countryLabel(s.country)}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 align-top text-xs text-gray-400 print:text-gray-600">
                        {shortenUA(s.user_agent)}
                      </td>
                      <td className="px-4 py-2 align-top text-xs text-gray-400 print:text-gray-600">
                        {formatTime(s.created_at)}
                      </td>
                      <td className="px-4 py-2 align-top text-xs text-gray-500 print:text-gray-600">
                        {timeAgo(s.last_seen)}
                      </td>
                      <td className="px-4 py-2 align-top text-right print:hidden">
                        <button
                          onClick={() => canRevoke && kickSession(s.id, s.label)}
                          disabled={!canRevoke}
                          title={canRevoke ? undefined : "Only a Super Admin can revoke a Super Admin session"}
                          className={`rounded border px-2 py-1 text-[11px] font-semibold transition ${
                            canRevoke
                              ? "border-white/10 text-gray-400 hover:border-rose-500/30 hover:text-rose-300"
                              : "cursor-not-allowed border-white/5 text-gray-600"
                          }`}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* PIN management — collapsible, hidden in print output. */}
      <section className="print:hidden">
        <button
          onClick={() => setManagePinsOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-gray-900 px-4 py-3 text-left text-sm font-semibold text-white hover:bg-white/5"
        >
          <span className="flex items-center gap-2">
            Manage PINs
            <span className="text-xs font-normal text-gray-500">
              · {pins.length} configured
            </span>
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={`size-4 transition-transform ${managePinsOpen ? "rotate-180" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {managePinsOpen && <PinManager pins={pins} currentRole={currentRole} onChange={load} />}
      </section>
    </div>
  );
}

// ─── PinManager ──────────────────────────────────────────────────────────

/**
 * The list of roles the current user is allowed to CREATE via the
 * Add-PIN form or assign via the Edit dropdown. Filtering here (plus
 * server-side enforcement in /api/pins) gives a consistent experience:
 * admins never even see "Super Admin" as an option, and the server
 * rejects any attempt to bypass the UI.
 */
function roleOptionsFor(actor: Role): Role[] {
  if (actor === "super_admin") return ["super_admin", "admin", "staff", "trade_desk"];
  if (actor === "admin") return ["admin", "staff", "trade_desk"];
  return [];
}

function PinManager({
  pins,
  currentRole,
  onChange,
}: {
  pins: Pin[];
  currentRole: Role;
  onChange: () => void;
}) {
  const creatableRoles = roleOptionsFor(currentRole);
  const canManage = currentRole === "super_admin" || currentRole === "admin";
  const [newLabel, setNewLabel] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>(
    creatableRoles.includes("staff") ? "staff" : creatableRoles[0] ?? "staff"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addPin() {
    if (!newLabel || !newPin) {
      setError("Label and PIN are required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel, pin: newPin, role: newRole, email: newEmail || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Failed to add PIN");
      } else {
        setNewLabel("");
        setNewPin("");
        setNewEmail("");
        setNewRole("staff");
        onChange();
      }
    } finally {
      setBusy(false);
    }
  }

  async function updatePin(
    id: string,
    patch: Partial<Pick<Pin, "label" | "pin" | "role" | "locked">> & { email?: string | null }
  ) {
    setBusy(true);
    try {
      await fetch("/api/pins", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function deletePin(id: string, label: string) {
    if (!confirm(`Delete PIN "${label}"? All active sessions using this PIN will be logged out.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/pins?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <div className="mt-3 rounded-lg border border-white/5 bg-gray-900 p-4 text-center text-xs text-gray-500">
        PIN management is restricted to Admin and Super Admin roles.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-white/5 bg-gray-900 p-4">
      {/* Add PIN form */}
      <div className="rounded-md border border-white/5 bg-gray-950 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Add PIN
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[120px]">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
              Label
            </label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Mumbai Staff"
              className="w-full rounded border border-white/10 bg-gray-900 px-2 py-1.5 text-sm text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none"
            />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
              PIN (4-8 digits)
            </label>
            <input
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              maxLength={8}
              placeholder="123456"
              className="w-full rounded border border-white/10 bg-gray-900 px-2 py-1.5 font-mono text-sm text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none"
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
              Role
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(coerceRole(e.target.value))}
              disabled={creatableRoles.length === 0}
              className="w-full rounded border border-white/10 bg-gray-900 px-2 py-1.5 text-sm text-white focus:border-amber-500/50 focus:outline-none disabled:opacity-40"
            >
              {creatableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
              Email (for Cloudflare)
            </label>
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              type="email"
              className="w-full rounded border border-white/10 bg-gray-900 px-2 py-1.5 text-sm text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none"
            />
          </div>
          <button
            onClick={addPin}
            disabled={busy || !newLabel || !newPin}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>

      {/* Existing PINs table */}
      <div className="overflow-x-auto rounded-md border border-white/5">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Label</th>
              <th className="px-3 py-2 text-left font-semibold">PIN</th>
              <th className="px-3 py-2 text-left font-semibold">Role</th>
              <th className="px-3 py-2 text-left font-semibold">Email</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Active</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {pins.map((p) => (
              <PinRow
                key={p.id}
                pin={p}
                currentRole={currentRole}
                busy={busy}
                onUpdate={updatePin}
                onDelete={deletePin}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500">
        Locked PINs cannot be used to log in, but existing sessions keep working
        until they&apos;re kicked or expire. Delete a PIN to also boot everyone
        currently logged in with it.
      </p>
    </div>
  );
}

function PinRow({
  pin,
  currentRole,
  busy,
  onUpdate,
  onDelete,
}: {
  pin: Pin;
  currentRole: Role;
  busy: boolean;
  onUpdate: (
    id: string,
    patch: Partial<Pick<Pin, "label" | "pin" | "role" | "locked">> & { email?: string | null }
  ) => void;
  onDelete: (id: string, label: string) => void;
}) {
  // Gate everything on whether the current user is actually allowed
  // to touch this row. Admin cannot modify super_admin rows at all.
  // Server will also refuse, but disabling the buttons avoids the
  // user clicking into an error dialog.
  const canModify = canModifyPinUi(currentRole, pin.role);
  const creatableRoles = roleOptionsFor(currentRole);
  const roleMeta = ROLE_META[pin.role];
  const lockLabelDisabled = !canModify
    ? "Only a Super Admin can lock/unlock this PIN"
    : undefined;

  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(pin.label);
  const [value, setValue] = useState(pin.pin);
  const [role, setRole] = useState<Role>(pin.role);
  const [emailVal, setEmailVal] = useState(pin.email || "");

  function save() {
    onUpdate(pin.id, { label, pin: value, role, email: emailVal || null });
    setEditing(false);
  }

  function cancel() {
    setLabel(pin.label);
    setValue(pin.pin);
    setRole(pin.role);
    setEmailVal(pin.email || "");
    setEditing(false);
  }

  return (
    <tr className={pin.locked ? "bg-rose-500/5" : ""}>
      <td className="px-3 py-2 align-middle">
        {editing ? (
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded border border-white/10 bg-gray-950 px-2 py-1 text-sm text-white focus:border-amber-500/50 focus:outline-none"
          />
        ) : (
          <span className={`font-semibold ${pin.locked ? "text-gray-500 line-through" : "text-white"}`}>
            {pin.label}
          </span>
        )}
      </td>
      <td className="px-3 py-2 align-middle">
        {editing ? (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
            maxLength={8}
            className="w-24 rounded border border-white/10 bg-gray-950 px-2 py-1 font-mono text-sm text-white focus:border-amber-500/50 focus:outline-none"
          />
        ) : (
          <span className={`font-mono text-sm ${pin.locked ? "text-gray-500" : "text-gray-300"}`}>
            {pin.pin}
          </span>
        )}
      </td>
      <td className="px-3 py-2 align-middle">
        {editing ? (
          <select
            value={role}
            onChange={(e) => setRole(coerceRole(e.target.value))}
            className="rounded border border-white/10 bg-gray-950 px-2 py-1 text-sm text-white focus:border-amber-500/50 focus:outline-none"
          >
            {creatableRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r].label}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${roleMeta.pillClass}`}
          >
            {roleMeta.label}
          </span>
        )}
      </td>
      <td className="px-3 py-2 align-middle">
        {editing ? (
          <input
            value={emailVal}
            onChange={(e) => setEmailVal(e.target.value)}
            placeholder="email@example.com"
            type="email"
            className="w-full min-w-[140px] rounded border border-white/10 bg-gray-950 px-2 py-1 text-sm text-white focus:border-amber-500/50 focus:outline-none"
          />
        ) : (
          <span className="text-xs text-gray-400">
            {pin.email || <span className="text-gray-600">—</span>}
          </span>
        )}
      </td>
      <td className="px-3 py-2 align-middle">
        {pin.locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Locked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Active
          </span>
        )}
      </td>
      <td className="px-3 py-2 align-middle">
        <span className="text-xs text-gray-400">
          {pin.active_sessions} session{pin.active_sessions === 1 ? "" : "s"}
        </span>
      </td>
      <td className="px-3 py-2 align-middle text-right">
        {editing ? (
          <div className="flex justify-end gap-1">
            <button
              onClick={save}
              disabled={busy}
              className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={cancel}
              disabled={busy}
              className="rounded bg-gray-700 px-2 py-1 text-xs font-semibold text-gray-200 hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-1">
            <button
              onClick={() => canModify && onUpdate(pin.id, { locked: !pin.locked })}
              disabled={busy || !canModify}
              title={lockLabelDisabled}
              className={`rounded border px-2 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                !canModify
                  ? "border-white/5 text-gray-600"
                  : pin.locked
                  ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                  : "border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
              }`}
            >
              {pin.locked ? "Unlock" : "Lock"}
            </button>
            <button
              onClick={() => canModify && setEditing(true)}
              disabled={!canModify}
              title={canModify ? undefined : "Only a Super Admin can edit this PIN"}
              className={`rounded border px-2 py-1 text-xs font-semibold transition ${
                canModify
                  ? "border-white/10 text-gray-300 hover:bg-white/5"
                  : "cursor-not-allowed border-white/5 text-gray-600"
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => canModify && onDelete(pin.id, pin.label)}
              disabled={!canModify}
              title={canModify ? undefined : "Only a Super Admin can delete this PIN"}
              className={`rounded border px-2 py-1 text-xs font-semibold transition ${
                canModify
                  ? "border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                  : "cursor-not-allowed border-white/5 text-gray-600"
              }`}
            >
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
