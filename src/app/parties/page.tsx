"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReportLetterhead } from "@/components/report-letterhead";

type Party = {
  id: string;
  name: string;
  short_code: string | null;
  aliases: string[];
  type: string;
  location: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  sbs_party_code: string | null;
  orosoft_party_code: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ active: showInactive ? "0" : "1", limit: "1000" });
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/parties?${params.toString()}`);
      const json = await res.json();
      setParties(json.parties ?? []);
    } catch { /* keep stale */ }
  }, [search, showInactive]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/parties/upload", { method: "POST", body: form });
      const json = await res.json();
      setUploadResult(
        json.ok
          ? `Upload complete: ${json.inserted} inserted, ${json.updated} updated${json.errors?.length ? `, ${json.errors.length} errors` : ""}`
          : `Upload failed: ${json.error}`
      );
      load();
    } catch {
      setUploadResult("Upload failed — network error");
    }
    if (fileRef.current) fileRef.current.value = "";
    setTimeout(() => setUploadResult(null), 5000);
  }

  async function handleSync(target: "sbs" | "orosoft") {
    try {
      const res = await fetch(`/api/parties/sync?target=${target}`);
      const json = await res.json();
      setSyncResult(json.error ?? json.message ?? "Sync complete");
    } catch {
      setSyncResult("Sync failed — network error");
    }
    setTimeout(() => setSyncResult(null), 5000);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Deactivate party "${name}"?`)) return;
    await fetch(`/api/parties?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4">
      <ReportLetterhead title="Party Master" subtitle={`${parties.length} ${showInactive ? "inactive" : "active"} parties`} />

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parties…"
            className="w-56 rounded border border-white/10 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none"
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-white/20"
            />
            Show inactive
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {uploadResult && <span className="text-xs text-emerald-400">{uploadResult}</span>}
          {syncResult && <span className="text-xs text-amber-300">{syncResult}</span>}
          <button onClick={() => setAddOpen(true)} className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500">
            + Add Party
          </button>
          <a href="/api/parties/template" className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/20">
            Download Template
          </a>
          <label className="cursor-pointer rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20">
            Upload CSV
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleUpload} className="hidden" />
          </label>
          <button onClick={() => handleSync("sbs")} className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/5">
            Sync SBS
          </button>
          <button onClick={() => handleSync("orosoft")} className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/5">
            Sync OroSoft
          </button>
          <button onClick={() => window.print()} className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20">
            Print
          </button>
        </div>
      </div>

      {/* Add party form */}
      {addOpen && <PartyForm onSave={() => { setAddOpen(false); load(); }} onCancel={() => setAddOpen(false)} />}

      {/* Edit party form */}
      {editId && (
        <PartyForm
          party={parties.find((p) => p.id === editId)}
          onSave={() => { setEditId(null); load(); }}
          onCancel={() => setEditId(null)}
        />
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/5 bg-gray-900 print:border-gray-300 print:bg-gray-50">
        <table className="w-full text-xs">
          <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-gray-400 print:bg-gray-100 print:text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Name</th>
              <th className="px-3 py-2 text-left font-semibold">Code</th>
              <th className="px-3 py-2 text-left font-semibold">Type</th>
              <th className="px-3 py-2 text-left font-semibold">Location</th>
              <th className="px-3 py-2 text-left font-semibold">SBS Code</th>
              <th className="px-3 py-2 text-left font-semibold">OroSoft Code</th>
              <th className="px-3 py-2 text-left font-semibold">Aliases</th>
              <th className="px-3 py-2 text-left font-semibold">Phone</th>
              <th className="px-3 py-2 text-right font-semibold print:hidden">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 print:divide-gray-200">
            {parties.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">No parties found.</td></tr>
            )}
            {parties.map((p) => (
              <tr key={p.id} className={!p.active ? "opacity-50" : ""}>
                <td className="px-3 py-2 font-semibold text-white print:text-black">{p.name}</td>
                <td className="px-3 py-2 font-mono text-gray-300 print:text-gray-700">{p.short_code ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                    p.type === "buyer" ? "bg-emerald-500/10 text-emerald-300" :
                    p.type === "seller" ? "bg-rose-500/10 text-rose-300" :
                    "bg-gray-500/10 text-gray-400"
                  }`}>
                    {p.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-400 print:text-gray-600">{p.location ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-sky-300 print:text-sky-800">{p.sbs_party_code ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-emerald-300 print:text-emerald-800">{p.orosoft_party_code ?? "—"}</td>
                <td className="px-3 py-2 text-gray-500 print:text-gray-600">
                  {p.aliases.length > 0 ? p.aliases.join(", ") : "—"}
                </td>
                <td className="px-3 py-2 text-gray-400 print:text-gray-600">{p.contact_phone ?? "—"}</td>
                <td className="px-3 py-2 text-right print:hidden">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditId(p.id)} className="rounded border border-white/10 px-2 py-1 text-[11px] font-semibold text-gray-300 hover:bg-white/5">Edit</button>
                    <button onClick={() => handleDelete(p.id, p.name)} className="rounded border border-rose-500/30 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/10">Deactivate</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Party form (add / edit) ──────────────────────────────────────────

function PartyForm({
  party,
  onSave,
  onCancel,
}: {
  party?: Party;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!party;
  const [name, setName] = useState(party?.name ?? "");
  const [shortCode, setShortCode] = useState(party?.short_code ?? "");
  const [type, setType] = useState(party?.type ?? "both");
  const [location, setLocation] = useState(party?.location ?? "");
  const [sbsCode, setSbsCode] = useState(party?.sbs_party_code ?? "");
  const [orosoftCode, setOrosoftCode] = useState(party?.orosoft_party_code ?? "");
  const [aliases, setAliases] = useState(party?.aliases.join(", ") ?? "");
  const [phone, setPhone] = useState(party?.contact_phone ?? "");
  const [email, setEmail] = useState(party?.contact_email ?? "");
  const [notes, setNotes] = useState(party?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) { setError("Name is required"); return; }
    setBusy(true);
    setError("");
    const body: Record<string, unknown> = {
      name, short_code: shortCode || null, type, location: location || null,
      sbs_party_code: sbsCode || null, orosoft_party_code: orosoftCode || null,
      aliases: aliases || null, contact_phone: phone || null,
      contact_email: email || null, notes: notes || null,
    };
    if (isEdit) body.id = party!.id;
    try {
      const res = await fetch("/api/parties", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { setError(json.error || "Failed"); return; }
      onSave();
    } finally { setBusy(false); }
  }

  const inputCls = "w-full rounded border border-white/10 bg-gray-950 px-2 py-1.5 text-sm text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none";
  const labelCls = "mb-1 block text-[10px] uppercase tracking-wider text-gray-500";

  return (
    <div className="rounded-lg border border-amber-500/30 bg-gray-900 p-4 print:hidden">
      <div className="mb-3 text-sm font-semibold text-white">{isEdit ? `Edit: ${party!.name}` : "Add Party"}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className={labelCls}>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Short Code</label><input value={shortCode} onChange={(e) => setShortCode(e.target.value.toUpperCase())} placeholder="TAKFUNG" className={inputCls} /></div>
        <div>
          <label className={labelCls}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            <option value="both">Both (Buyer + Seller)</option>
            <option value="buyer">Buyer only</option>
            <option value="seller">Seller only</option>
          </select>
        </div>
        <div><label className={labelCls}>Location</label><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="hong_kong" className={inputCls} /></div>
        <div><label className={labelCls}>SBS Party Code</label><input value={sbsCode} onChange={(e) => setSbsCode(e.target.value)} placeholder="TF001" className={`${inputCls} font-mono`} /></div>
        <div><label className={labelCls}>OroSoft Party Code</label><input value={orosoftCode} onChange={(e) => setOrosoftCode(e.target.value)} placeholder="ORO-TF-001" className={`${inputCls} font-mono`} /></div>
        <div><label className={labelCls}>Aliases (comma-separated)</label><input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="TAK FUNG, TF TRADING" className={inputCls} /></div>
        <div><label className={labelCls}>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></div>
        <div className="sm:col-span-2 lg:col-span-3"><label className={labelCls}>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40">
          {busy ? "Saving…" : isEdit ? "Update" : "Create"}
        </button>
        <button onClick={onCancel} className="rounded-md border border-white/10 bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
