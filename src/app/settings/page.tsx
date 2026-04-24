"use client";

import { useState, useEffect } from "react";
import { useFy } from "@/components/fy-provider";
import { deriveFy, parseFyStart } from "@/lib/financial-year";

const DATA_SOURCES = [
  {
    id: "excel",
    name: "Excel Upload",
    badge: "Easy Start",
    badgeColor: "bg-emerald-500/10 text-emerald-400",
    icon: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
    description: "Your staff exports an Excel file from the existing software and uploads it here. Works immediately — no changes to your current system, no installation needed.",
    pros: ["No changes to your existing software or server", "Staff already knows how to export from existing software", "Start seeing real data on this dashboard in minutes", "Zero risk — existing software is completely untouched"],
    cons: ["Manual step — staff needs to export and upload once or twice a day", "Not real-time — data is only as fresh as the last upload", "Depends on staff remembering to do the export"],
    frequency: "Once or twice a day",
    effort: "Zero installation. Staff exports from existing software and uploads here.",
  },
  {
    id: "bridge",
    name: "Live Data Bridge",
    badge: "Recommended",
    badgeColor: "bg-amber-500/10 text-amber-400",
    icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
    description: "A small read-only program sits alongside your existing software on the Dubai server. It reads the database every 15-30 minutes and sends the data to this dashboard automatically. Your existing software continues to work exactly as before — nothing is changed or touched.",
    pros: ["Fully automatic — zero daily effort from staff", "Near real-time data (every 15-30 minutes)", "Existing software is never modified — read-only access", "Once set up, it runs silently forever", "Your staff keeps using existing software as normal"],
    cons: ["Requires one-time installation of a small program on your Dubai server", "We need to understand your existing software's database format (one-time analysis)", "Needs 2-3 hours of initial setup on the server"],
    frequency: "Every 15-30 minutes (automatic)",
    effort: "One-time 2-3 hour setup on your server. Existing software untouched.",
  },
  {
    id: "export",
    name: "Scheduled Auto-Export",
    badge: "Automated",
    badgeColor: "bg-blue-500/10 text-blue-400",
    icon: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    description: "If your existing software supports automatic/scheduled exports, we configure it to export data to a folder every 30-60 minutes. Our system picks up the file automatically and imports it — no manual work from staff at all.",
    pros: ["No manual effort from staff after initial setup", "Existing software handles the export on its own schedule", "Data refreshes automatically throughout the day", "No additional programs installed — uses existing software's own export feature"],
    cons: ["Only works if existing software supports scheduled/automatic export", "Not instant — data freshness depends on the export schedule", "Requires one-time configuration of auto-export in existing software"],
    frequency: "Every 30-60 minutes (scheduled)",
    effort: "Configure auto-export in existing software + one-time setup. No new software installed.",
  },
  {
    id: "vpn",
    name: "Secure VPN Access",
    badge: "Real-Time",
    badgeColor: "bg-purple-500/10 text-purple-400",
    icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
    description: "We connect to your Dubai server through a secure VPN tunnel with read-only credentials — the same way your staff connects from Mumbai. Our system reads the data from existing software's database directly. Nothing is installed on your server.",
    pros: ["Real-time data — the freshest possible, every 5-15 minutes", "Nothing installed on your server at all", "We manage everything remotely — zero effort from your side", "Same secure VPN your staff already uses from Mumbai"],
    cons: ["Requires VPN credentials to be shared with our system", "Requires a read-only database user to be created", "You need to be comfortable with an external system having read-only VPN access"],
    frequency: "Real-time (every 5-15 minutes)",
    effort: "Provide VPN credentials + read-only database user. Nothing installed on your server.",
  },
];

export default function SettingsPage() {
  const { fyStart, refresh: refreshFy } = useFy();
  const [liveApi, setLiveApi] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [resetting, setResetting] = useState(false);
  const [selectedSource, setSelectedSource] = useState("bridge");

  // Financial-year editor state. fyStartMonth/Day are <select> values;
  // on save we format them back to a MM-DD string and PUT to
  // /api/settings. The provider refreshes afterwards so the top-bar
  // dropdown picks up the new window without a page reload.
  const parsedFy = parseFyStart(fyStart);
  const [fyStartMonth, setFyStartMonth] = useState(parsedFy.month);
  const [fyStartDay, setFyStartDay] = useState(parsedFy.day);
  const [fySaveStatus, setFySaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Keep the local form in sync if the provider reloads (e.g. another
  // tab saved a different FY). Deliberate dependency on fyStart so we
  // don't clobber in-flight edits when the form matches the server.
  useEffect(() => {
    const p = parseFyStart(fyStart);
    setFyStartMonth(p.month);
    setFyStartDay(p.day);
  }, [fyStart]);

  async function handleFySave() {
    setFySaveStatus("saving");
    const mm = String(fyStartMonth).padStart(2, "0");
    const dd = String(fyStartDay).padStart(2, "0");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "financial_year_start", value: `${mm}-${dd}` }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFySaveStatus("error");
        return;
      }
      // Pull the new value back into the global context so the top-bar
      // dropdown rebuilds its FY list against the new start date.
      refreshFy();
      setFySaveStatus("saved");
      setTimeout(() => setFySaveStatus("idle"), 2500);
    } catch {
      setFySaveStatus("error");
      setTimeout(() => setFySaveStatus("idle"), 2500);
    }
  }

  // Preview of which FY window the current form would produce.
  const previewFy = deriveFy(
    `${String(fyStartMonth).padStart(2, "0")}-${String(fyStartDay).padStart(2, "0")}`
  );

  // Meta WhatsApp config state
  const [metaVerifyToken, setMetaVerifyToken] = useState("prismx_webhook_verify");
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaAnthropicKey, setMetaAnthropicKey] = useState("");
  const [metaGoogleKey, setMetaGoogleKey] = useState("");
  const [metaOpenaiKey, setMetaOpenaiKey] = useState("");
  const [metaOcrProvider, setMetaOcrProvider] = useState("tesseract");
  const [metaSaving, setMetaSaving] = useState(false);
  const [ocrTesting, setOcrTesting] = useState(false);
  const [ocrResult, setOcrResult] = useState<{ provider: string; type: string; amount?: number; currency?: string; sender_wallet?: string; receiver_wallet?: string; transaction_id?: string; date?: string; status?: string; weight_grams?: number; bar_count?: number; raw_text: string } | null>(null);
  const [metaSaveStatus, setMetaSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [webhookCopied, setWebhookCopied] = useState(false);

  const WEBHOOK_URL = "https://nt.areakpi.in/api/whatsapp/webhook";

  useEffect(() => {
    fetch("/api/whatsapp/config")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        if (data.verify_token) setMetaVerifyToken(data.verify_token);
        if (data.app_secret) setMetaAppSecret(data.app_secret);
        if (data.phone_number_id) setMetaPhoneNumberId(data.phone_number_id);
        if (data.access_token) setMetaAccessToken(data.access_token);
        if (data.anthropic_api_key) setMetaAnthropicKey(data.anthropic_api_key);
        if (data.google_api_key) setMetaGoogleKey(data.google_api_key);
        if (data.openai_api_key) setMetaOpenaiKey(data.openai_api_key);
        if (data.ocr_provider) setMetaOcrProvider(data.ocr_provider);
      })
      .catch(() => {});
  }, []);

  async function handleMetaSave() {
    setMetaSaving(true);
    setMetaSaveStatus("idle");
    try {
      const res = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verify_token: metaVerifyToken,
          app_secret: metaAppSecret,
          phone_number_id: metaPhoneNumberId,
          access_token: metaAccessToken,
          anthropic_api_key: metaAnthropicKey,
          google_api_key: metaGoogleKey,
          openai_api_key: metaOpenaiKey,
          ocr_provider: metaOcrProvider,
        }),
      });
      setMetaSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setMetaSaveStatus("error");
    } finally {
      setMetaSaving(false);
      setTimeout(() => setMetaSaveStatus("idle"), 3000);
    }
  }

  function handleCopyWebhook() {
    navigator.clipboard.writeText(WEBHOOK_URL).then(() => {
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    });
  }

  const inputCls = "block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";

  async function handleReset() {
    const ok = confirm(
      "⚠️ RESET ALL TRADE DATA\n\n" +
      "This will permanently delete:\n" +
      "• All trades (pending, approved, dispatched)\n" +
      "• Dispatch history & OroSoft doc numbers\n" +
      "• Audit log\n" +
      "• Notifications\n" +
      "• Opening stock register\n" +
      "• WhatsApp message log\n\n" +
      "These will be KEPT:\n" +
      "✓ Users & sessions\n" +
      "✓ Parties & OroSoft mappings\n" +
      "✓ API credentials (OroSoft, WhatsApp, Cloudflare)\n" +
      "✓ Prices\n\n" +
      "This cannot be undone. Continue?"
    );
    if (!ok) return;
    setResetting(true);
    await fetch("/api/simulator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset" }) });
    setResetting(false);
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-sm text-gray-400">Configure data sources and system behavior.</p>
      </div>

      {/* Financial Year */}
      <div>
        <h2 className="mb-1 text-sm font-semibold text-white">Financial Year</h2>
        <p className="mb-4 text-xs text-gray-400">
          The start date of your financial year. Every page with a date filter
          (Deals, Stock, Reports) will show data in this year&apos;s window.
          Default is 1 April, matching the Indian fiscal calendar.
        </p>
        <div className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
                Start Month
              </label>
              <select
                value={fyStartMonth}
                onChange={(e) => setFyStartMonth(parseInt(e.target.value, 10))}
                className="rounded border border-white/10 bg-gray-950 px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
              >
                {[
                  "January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December",
                ].map((name, i) => (
                  <option key={name} value={i + 1}>
                    {String(i + 1).padStart(2, "0")} — {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
                Start Day
              </label>
              <select
                value={fyStartDay}
                onChange={(e) => setFyStartDay(parseInt(e.target.value, 10))}
                className="rounded border border-white/10 bg-gray-950 px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {String(d).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleFySave}
              disabled={fySaveStatus === "saving"}
              className="rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-40"
            >
              {fySaveStatus === "saving" ? "Saving…" : "Save"}
            </button>
            {fySaveStatus === "saved" && (
              <span className="text-xs text-emerald-400">Saved</span>
            )}
            {fySaveStatus === "error" && (
              <span className="text-xs text-rose-400">
                Please pick a valid date
              </span>
            )}
          </div>
          <div className="mt-3 rounded-md bg-white/5 px-3 py-2 text-xs text-gray-400">
            Current FY preview:{" "}
            <span className="font-semibold text-amber-300">{previewFy.label}</span>{" "}
            · {new Date(previewFy.fromIso).toLocaleDateString("en-IN")} →{" "}
            {new Date(
              new Date(previewFy.toIso).getTime() - 86_400_000
            ).toLocaleDateString("en-IN")}
          </div>
          <p className="mt-2 text-[10px] text-gray-500">
            Tip: the FY boundary is a half-open window on the IST calendar —
            trades at 11:59 PM on the last day of FY X-Y stay in FY X-Y, and
            trades at 12:01 AM on the next day move to FY Y-Z.
          </p>
        </div>
      </div>

      {/* Data Source Selection */}
      <div>
        <h2 className="mb-1 text-sm font-semibold text-white">Data Source</h2>
        <p className="mb-4 text-xs text-gray-400">Choose how your transaction data flows into the dashboard.</p>
        <div className="space-y-3">
          {DATA_SOURCES.map((source) => {
            const isSelected = selectedSource === source.id;
            return (
              <button
                key={source.id}
                onClick={() => setSelectedSource(source.id)}
                className={`w-full rounded-lg p-4 text-left outline outline-1 transition ${
                  isSelected
                    ? "bg-gray-800/80 outline-amber-500/50"
                    : "bg-gray-900 outline-white/10 hover:bg-gray-800/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${isSelected ? "bg-amber-500/20" : "bg-white/5"}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={`size-5 ${isSelected ? "text-amber-400" : "text-gray-400"}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={source.icon} />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${isSelected ? "text-white" : "text-gray-200"}`}>{source.name}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${source.badgeColor}`}>{source.badge}</span>
                      {isSelected && (
                        <svg viewBox="0 0 24 24" fill="currentColor" className="ml-auto size-5 shrink-0 text-amber-400">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{source.description}</p>

                    {isSelected && (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center gap-2 text-xs">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4 text-gray-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </svg>
                          <span className="text-gray-400">Update frequency:</span>
                          <span className="text-white">{source.frequency}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4 text-gray-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.193-.14 1.743" />
                          </svg>
                          <span className="text-gray-400">Setup effort:</span>
                          <span className="text-white">{source.effort}</span>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-md bg-emerald-500/5 p-2.5">
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Advantages</p>
                            <ul className="space-y-1">
                              {source.pros.map((pro, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 size-3 shrink-0 text-emerald-400">
                                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                                  </svg>
                                  {pro}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-md bg-rose-500/5 p-2.5">
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-400">Considerations</p>
                            <ul className="space-y-1">
                              {source.cons.map((con, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 size-3 shrink-0 text-rose-400">
                                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                                  </svg>
                                  {con}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Price Feed */}
      <div className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Price Feed</h2>
        <p className="mt-1 text-xs text-gray-400">Toggle between demo prices and live LBMA prices.</p>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setLiveApi(!liveApi)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${liveApi ? "bg-amber-600" : "bg-gray-700"}`}>
            <span className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${liveApi ? "translate-x-5.5" : "translate-x-0.5"}`} />
          </button>
          <span className="text-sm text-gray-300">{liveApi ? "Live LBMA" : "Demo Prices"}</span>
        </div>
        {liveApi && (
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-400">goldapi.io API Key</label>
            <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter API key..." className={`mt-1 ${inputCls}`} />
          </div>
        )}
      </div>

      {/* Data Management */}
      <div className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Data Management</h2>
        <p className="mt-1 text-xs text-gray-400">
          Clear all trade data for go-live. Removes all trades, dispatches, audit log, and notifications.
          Keeps users, parties, credentials, and prices.
        </p>
        <div className="mt-3 rounded-md border border-white/5 bg-gray-950 p-3 text-xs text-gray-500">
          <div className="mb-1 font-semibold text-gray-400">Will be cleared:</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <span>• Pending / approved trades</span>
            <span>• Dispatch log & doc numbers</span>
            <span>• Audit trail</span>
            <span>• Notifications</span>
            <span>• Opening stock register</span>
            <span>• WhatsApp messages</span>
          </div>
        </div>
        <div className="mt-4">
          <button onClick={handleReset} disabled={resetting} className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50">
            {resetting ? "Resetting..." : "Reset All Trade Data"}
          </button>
        </div>
      </div>

      {/* Meta WhatsApp Business API */}
      <div className="rounded-lg bg-gray-900 p-4 outline outline-1 outline-white/10 sm:p-6">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-5 text-green-400">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          <h2 className="text-sm font-semibold text-white">Meta WhatsApp Business API</h2>
        </div>
        <p className="mt-1 text-xs text-gray-400">Connect your WhatsApp Business account to receive messages and auto-detect deals via Meta Cloud API.</p>

        <div className="mt-4 space-y-4">
          {/* Webhook URL */}
          <div>
            <label className="block text-xs font-medium text-gray-400">Webhook URL</label>
            <p className="mb-1 text-[11px] text-gray-500">Paste this into your Meta App Dashboard under WhatsApp &gt; Configuration &gt; Webhook.</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={WEBHOOK_URL}
                className={`${inputCls} cursor-default select-all font-mono text-xs text-amber-300`}
              />
              <button
                onClick={handleCopyWebhook}
                className="shrink-0 rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 outline outline-1 outline-white/10 hover:bg-white/10"
              >
                {webhookCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Verify Token */}
          <div>
            <label className="block text-xs font-medium text-gray-400">Verify Token</label>
            <p className="mb-1 text-[11px] text-gray-500">Must match what you enter in Meta App Dashboard when configuring the webhook.</p>
            <input
              type="text"
              value={metaVerifyToken}
              onChange={(e) => setMetaVerifyToken(e.target.value)}
              placeholder="prismx_webhook_verify"
              className={`mt-1 ${inputCls}`}
            />
          </div>

          {/* App Secret */}
          <div>
            <label className="block text-xs font-medium text-gray-400">Meta App Secret</label>
            <p className="mb-1 text-[11px] text-gray-500">Found in Meta App Dashboard &gt; Settings &gt; Basic. Used to verify webhook signatures.</p>
            <input
              type="password"
              value={metaAppSecret}
              onChange={(e) => setMetaAppSecret(e.target.value)}
              placeholder="Enter app secret..."
              className={`mt-1 ${inputCls}`}
            />
          </div>

          {/* Phone Number ID */}
          <div>
            <label className="block text-xs font-medium text-gray-400">Phone Number ID</label>
            <p className="mb-1 text-[11px] text-gray-500">Found in Meta App Dashboard &gt; WhatsApp &gt; API Setup.</p>
            <input
              type="text"
              value={metaPhoneNumberId}
              onChange={(e) => setMetaPhoneNumberId(e.target.value)}
              placeholder="Enter phone number ID..."
              className={`mt-1 ${inputCls}`}
            />
          </div>

          {/* Access Token */}
          <div>
            <label className="block text-xs font-medium text-gray-400">Access Token</label>
            <p className="mb-1 text-[11px] text-gray-500">Permanent system user token or temporary access token from Meta App Dashboard.</p>
            <input
              type="password"
              value={metaAccessToken}
              onChange={(e) => setMetaAccessToken(e.target.value)}
              placeholder="Enter access token..."
              className={`mt-1 ${inputCls}`}
            />
          </div>

          {/* ─── Image OCR Provider ─── */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">Image OCR — Read Payment Screenshots</h3>
            <p className="mt-1 text-[11px] text-gray-500">Choose how payment screenshots and bar list photos are read. Each option has different capabilities and cost.</p>

            <div className="mt-3 space-y-2">
              {[
                {
                  id: "tesseract",
                  name: "Built-in Image OCR",
                  badge: "100% Free",
                  badgeColor: "bg-emerald-500/10 text-emerald-400",
                  desc: "Built-in OCR engine runs directly on the server. No external API calls, no cost, no limits. Reads English, Chinese, and Arabic text.",
                  pros: "Free forever, no API key needed, works offline, unlimited images, supports English + Chinese + Arabic",
                  cons: "Lower accuracy on complex screenshots with mixed layouts. May miss wallet addresses or transaction IDs in stylized text. Best for simple text extraction.",
                  needsKey: false,
                },
                {
                  id: "google",
                  name: "Google Cloud Vision",
                  badge: "1,000 Free/Month",
                  badgeColor: "bg-blue-500/10 text-blue-400",
                  desc: "Google's production OCR. Best text extraction quality. 1,000 images/month on free tier — no credit card needed.",
                  pros: "Excellent accuracy, reads all languages, handles complex layouts, 1,000 free/month",
                  cons: "Needs Google Cloud account + API key. Beyond 1,000 images: $1.50 per 1,000. Extracts text only — doesn't understand context (e.g. won't know it's a USDT payment).",
                  needsKey: true,
                  keyField: "google",
                },
                {
                  id: "claude",
                  name: "Claude Vision (AI)",
                  badge: "Best Understanding",
                  badgeColor: "bg-purple-500/10 text-purple-400",
                  desc: "Anthropic's AI reads AND understands the image. Knows it's a USDT payment, extracts amount, wallet, status, and transaction ID intelligently.",
                  pros: "Best context understanding, returns structured data, handles any language, identifies payment type automatically",
                  cons: "~$0.01-0.03 per image. Needs Anthropic API key. $5 free credit for new accounts.",
                  needsKey: true,
                  keyField: "anthropic",
                },
                {
                  id: "openai",
                  name: "GPT-4o-mini (AI)",
                  badge: "Cheapest AI",
                  badgeColor: "bg-cyan-500/10 text-cyan-400",
                  desc: "OpenAI's lightweight vision model. Good understanding at the lowest AI cost. $5 free credit for new accounts.",
                  pros: "Very cheap (~$0.003/image), good accuracy, returns structured data",
                  cons: "Needs OpenAI API key. Slightly less accurate than Claude on Chinese text.",
                  needsKey: true,
                  keyField: "openai",
                },
              ].map((opt) => {
                const isSelected = metaOcrProvider === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setMetaOcrProvider(opt.id)}
                    className={`w-full rounded-lg p-3 text-left outline outline-1 transition ${isSelected ? "bg-gray-800/80 outline-amber-500/50" : "bg-gray-900 outline-white/10 hover:bg-gray-800/50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${isSelected ? "text-white" : "text-gray-200"}`}>{opt.name}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${opt.badgeColor}`}>{opt.badge}</span>
                      {isSelected && (
                        <svg viewBox="0 0 24 24" fill="currentColor" className="ml-auto size-5 shrink-0 text-amber-400">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">{opt.desc}</p>
                    {isSelected && (
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-md bg-emerald-500/5 p-2">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">Pros</p>
                          <p className="mt-0.5 text-[10px] text-gray-300">{opt.pros}</p>
                        </div>
                        <div className="rounded-md bg-rose-500/5 p-2">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-rose-400">Limitations</p>
                          <p className="mt-0.5 text-[10px] text-gray-300">{opt.cons}</p>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* API Key fields based on selection */}
            {metaOcrProvider === "google" && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-400">Google Cloud Vision API Key</label>
                <p className="mb-1 text-[11px] text-gray-500">console.cloud.google.com → Enable Vision API → Credentials → Create API Key</p>
                <input type="password" value={metaGoogleKey} onChange={(e) => setMetaGoogleKey(e.target.value)} placeholder="AIza..." className={`mt-1 ${inputCls}`} />
              </div>
            )}
            {metaOcrProvider === "claude" && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-400">Anthropic API Key</label>
                <p className="mb-1 text-[11px] text-gray-500">console.anthropic.com → API Keys → Create Key ($5 free credit for new accounts)</p>
                <input type="password" value={metaAnthropicKey} onChange={(e) => setMetaAnthropicKey(e.target.value)} placeholder="sk-ant-..." className={`mt-1 ${inputCls}`} />
              </div>
            )}
            {metaOcrProvider === "openai" && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-400">OpenAI API Key</label>
                <p className="mb-1 text-[11px] text-gray-500">platform.openai.com → API Keys → Create Key ($5 free credit for new accounts)</p>
                <input type="password" value={metaOpenaiKey} onChange={(e) => setMetaOpenaiKey(e.target.value)} placeholder="sk-..." className={`mt-1 ${inputCls}`} />
              </div>
            )}
            {metaOcrProvider === "tesseract" && (
              <div className="mt-3 rounded-md bg-emerald-500/5 p-3">
                <p className="text-xs text-emerald-400">No API key needed. Built-in OCR engine runs directly on the server — completely free, unlimited images, supports English, Chinese, and Arabic.</p>
              </div>
            )}
          </div>

          {/* ─── Test OCR ─── */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">Test Image OCR</h3>
            <p className="mt-1 text-[11px] text-gray-500">Upload a payment screenshot or bar list photo to test the OCR engine. Uses the provider selected above.</p>

            <div className="mt-3">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-gray-800/30 px-4 py-6 transition hover:border-amber-500/50 hover:bg-gray-800/50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-8 text-gray-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H3.75A2.25 2.25 0 0 0 1.5 6v12.75c0 1.243 1.007 2.25 2.25 2.25Z" />
                </svg>
                <span className="mt-2 text-xs text-gray-400">{ocrTesting ? "Analyzing..." : "Tap to upload image"}</span>
                <span className="text-[10px] text-gray-500">JPG, PNG — payment screenshots, bar lists, receipts</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={ocrTesting}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setOcrTesting(true);
                    setOcrResult(null);
                    try {
                      const form = new FormData();
                      form.append("image", file);
                      const res = await fetch("/api/ocr-test", { method: "POST", body: form });
                      const data = await res.json();
                      setOcrResult(data);
                    } catch {
                      setOcrResult({ provider: "error", type: "unknown", raw_text: "Failed to analyze image" });
                    }
                    setOcrTesting(false);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {ocrTesting && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-400">
                <div className="size-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                Reading image...
              </div>
            )}

            {ocrResult && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${ocrResult.type === "payment" ? "bg-emerald-500/20 text-emerald-400" : ocrResult.type === "barlist" ? "bg-blue-500/20 text-blue-400" : "bg-gray-500/20 text-gray-400"}`}>
                    {ocrResult.type.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-gray-500">via {ocrResult.provider === "tesseract" ? "Built-in OCR" : ocrResult.provider}</span>
                </div>

                {/* Structured data */}
                {(ocrResult.amount || ocrResult.weight_grams) && (
                  <div className="rounded-lg bg-white/5 p-3 space-y-1.5">
                    {ocrResult.amount && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Amount</span>
                        <span className="font-semibold text-emerald-400">{ocrResult.currency} {ocrResult.amount.toLocaleString()}</span>
                      </div>
                    )}
                    {ocrResult.sender_wallet && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">From</span>
                        <span className="font-mono text-[10px] text-gray-300">{ocrResult.sender_wallet.substring(0, 8)}...{ocrResult.sender_wallet.slice(-6)}</span>
                      </div>
                    )}
                    {ocrResult.receiver_wallet && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">To</span>
                        <span className="font-mono text-[10px] text-gray-300">{ocrResult.receiver_wallet.substring(0, 8)}...{ocrResult.receiver_wallet.slice(-6)}</span>
                      </div>
                    )}
                    {ocrResult.transaction_id && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Tx ID</span>
                        <span className="font-mono text-[10px] text-gray-300">{ocrResult.transaction_id.substring(0, 12)}...</span>
                      </div>
                    )}
                    {ocrResult.date && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Date</span>
                        <span className="text-gray-300">{ocrResult.date}</span>
                      </div>
                    )}
                    {ocrResult.status && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Status</span>
                        <span className={`font-medium ${ocrResult.status === "confirmed" ? "text-emerald-400" : "text-amber-400"}`}>{ocrResult.status}</span>
                      </div>
                    )}
                    {ocrResult.weight_grams && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Weight</span>
                        <span className="text-gray-300">{ocrResult.weight_grams >= 1000 ? (ocrResult.weight_grams / 1000).toFixed(2) + " kg" : ocrResult.weight_grams + "g"}</span>
                      </div>
                    )}
                    {ocrResult.bar_count && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Bars</span>
                        <span className="text-gray-300">{ocrResult.bar_count} pcs</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Raw text */}
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Extracted Text</p>
                  <pre className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-gray-800/50 p-3 text-[11px] text-gray-300 whitespace-pre-wrap break-all">{ocrResult.raw_text || "(no text detected)"}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Save button + status */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleMetaSave}
              disabled={metaSaving}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-600 disabled:opacity-50"
            >
              {metaSaving ? "Saving..." : "Save WhatsApp Config"}
            </button>
            {metaSaveStatus === "saved" && (
              <span className="text-xs font-medium text-green-400">Saved successfully.</span>
            )}
            {metaSaveStatus === "error" && (
              <span className="text-xs font-medium text-rose-400">Save failed. Please try again.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
