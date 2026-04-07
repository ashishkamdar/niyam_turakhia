"use client";

import { useState } from "react";

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
  const [liveApi, setLiveApi] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [resetting, setResetting] = useState(false);
  const [selectedSource, setSelectedSource] = useState("bridge");

  const inputCls = "block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";

  async function handleReset() {
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
        <p className="mt-1 text-xs text-gray-400">Reset all demo data and re-seed with fresh transactions.</p>
        <div className="mt-4">
          <button onClick={handleReset} disabled={resetting} className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50">
            {resetting ? "Resetting..." : "Reset All Data"}
          </button>
        </div>
      </div>
    </div>
  );
}
