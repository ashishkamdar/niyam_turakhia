"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [liveApi, setLiveApi] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [resetting, setResetting] = useState(false);

  const inputCls = "block w-full rounded-md bg-white/5 px-3 py-1.5 text-sm text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-amber-500";

  async function handleReset() {
    setResetting(true);
    await fetch("/api/simulator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset" }) });
    setResetting(false);
    window.location.reload();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-sm text-gray-400">Configure demo behavior.</p>
      </div>
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
