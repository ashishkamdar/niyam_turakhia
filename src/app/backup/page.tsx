"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";

type Backup = {
  filename: string;
  encrypted: boolean;
  size_bytes: number;
  size_human: string;
  created_at: string;
};

export default function BackupPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [encrypt, setEncrypt] = useState(false);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showRestore, setShowRestore] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) { setMessage({ text: "Admin access required", type: "error" }); return; }
      const json = await res.json();
      setBackups(json.backups ?? []);
    } catch { /* keep stale */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createBackup() {
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passphrase: encrypt && passphrase ? passphrase : undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setMessage({
          text: `Backup created: ${json.filename} (${json.size_human}, ${json.rows} rows, ${json.encrypted ? "encrypted" : "unencrypted"})`,
          type: "success",
        });
        setPassphrase("");
        load();
      } else {
        setMessage({ text: json.error || "Backup failed", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error", type: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function downloadBackup(filename: string) {
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", filename }),
      });
      if (!res.ok) { setMessage({ text: "Download failed", type: "error" }); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ text: "Download failed", type: "error" });
    }
  }

  async function deleteBackup(filename: string) {
    if (!confirm(`Delete backup "${filename}"? This cannot be undone.`)) return;
    try {
      await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", filename }),
      });
      load();
    } catch { /* silent */ }
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isEnc = file.name.endsWith(".enc");
    if (isEnc && !restorePassphrase) {
      setMessage({ text: "This backup is encrypted — enter the passphrase first, then select the file again.", type: "error" });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    if (!confirm(`Restore from "${file.name}"? This will OVERWRITE all current data. Are you sure?`)) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setRestoring(true);
    setMessage(null);
    const form = new FormData();
    form.append("action", "restore");
    form.append("file", file);
    if (restorePassphrase) form.append("passphrase", restorePassphrase);

    try {
      const res = await fetch("/api/backup", { method: "POST", body: form });
      const json = await res.json();
      if (json.ok) {
        setMessage({
          text: `Restore complete: ${json.restored_rows} rows across ${json.tables_restored} tables. Refresh the page to see updated data.`,
          type: "success",
        });
        setRestorePassphrase("");
      } else {
        setMessage({ text: json.error || "Restore failed", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error during restore", type: "error" });
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Backup & Restore</h1>
        <p className="mt-1 text-xs text-gray-400">
          Create full database backups, download them, or restore from a previous backup.
          Encrypted backups use AES-256-GCM — the passphrase never leaves your browser.
        </p>
      </div>

      {/* Status message */}
      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          message.type === "success"
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
            : "border-rose-500/30 bg-rose-500/5 text-rose-300"
        }`}>
          {message.text}
        </div>
      )}

      {/* Create backup */}
      <section className="rounded-xl border border-white/10 bg-gray-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Create Backup</h2>
        <p className="mb-4 text-xs text-gray-400">
          Backs up all {17} database tables ({backups.length > 0 ? "last backup: " + formatDate(backups[0]?.created_at) : "no backups yet"}).
          Screenshots are stored on the filesystem — use <code className="rounded bg-white/5 px-1 py-0.5 text-amber-300">scripts/backup.sh</code> for a full backup including images.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={encrypt}
              onChange={(e) => setEncrypt(e.target.checked)}
              className="rounded border-white/20"
            />
            Encrypt backup
          </label>
          {encrypt && (
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
                Passphrase
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter a strong passphrase"
                className="w-64 rounded border border-white/10 bg-gray-950 px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
          )}
          <button
            onClick={createBackup}
            disabled={creating || (encrypt && !passphrase)}
            className="rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? "Creating…" : encrypt ? "Create Encrypted Backup" : "Create Backup"}
          </button>
        </div>
      </section>

      {/* Backup list */}
      <section className="rounded-xl border border-white/10 bg-gray-900 p-5">
        <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-white">
          <span>Previous Backups</span>
          <span className="text-xs font-normal text-gray-500">{backups.length} backup{backups.length === 1 ? "" : "s"}</span>
        </h2>
        {backups.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">
            No backups yet. Create your first backup above.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/5">
            <table className="w-full text-xs">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Filename</th>
                  <th className="px-4 py-2 text-left font-semibold">Created</th>
                  <th className="px-4 py-2 text-left font-semibold">Size</th>
                  <th className="px-4 py-2 text-left font-semibold">Encrypted</th>
                  <th className="px-4 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {backups.map((b) => (
                  <tr key={b.filename}>
                    <td className="px-4 py-2 font-mono text-gray-300">{b.filename}</td>
                    <td className="px-4 py-2 text-gray-400">{formatDate(b.created_at)}</td>
                    <td className="px-4 py-2 tabular-nums text-gray-400">{b.size_human}</td>
                    <td className="px-4 py-2">
                      {b.encrypted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-300">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                          AES-256
                        </span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => downloadBackup(b.filename)}
                          className="rounded border border-sky-500/30 px-2 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/10"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => deleteBackup(b.filename)}
                          className="rounded border border-rose-500/30 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Restore */}
      <section className="rounded-xl border border-white/10 bg-gray-900 p-5">
        <button
          onClick={() => setShowRestore(!showRestore)}
          className="flex w-full items-center justify-between text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-white">Restore from Backup</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Upload a previously downloaded backup file to restore all data.
            </p>
          </div>
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className={`size-4 text-gray-400 transition-transform ${showRestore ? "rotate-180" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showRestore && (
          <div className="mt-4 space-y-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
            <div className="flex items-start gap-2 text-xs text-rose-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5 shrink-0 text-rose-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <div className="font-semibold">This will OVERWRITE all current data.</div>
                <div className="mt-0.5 leading-relaxed">
                  Every table in the database will be cleared and replaced with the data from the
                  backup file. There is no undo. Create a fresh backup first if you want to be safe.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
                  Passphrase (for encrypted backups)
                </label>
                <input
                  type="password"
                  value={restorePassphrase}
                  onChange={(e) => setRestorePassphrase(e.target.value)}
                  placeholder="Leave empty for unencrypted backups"
                  className="w-64 rounded border border-white/10 bg-gray-950 px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <label className={`cursor-pointer rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 ${restoring ? "cursor-not-allowed opacity-40" : ""}`}>
                {restoring ? "Restoring…" : "Select Backup File & Restore"}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,.enc"
                  onChange={handleRestore}
                  disabled={restoring}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </section>

      {/* Info box */}
      <div className="rounded-lg border border-white/5 bg-gray-900 p-4 text-xs text-gray-500">
        <div className="font-semibold text-gray-400">Notes</div>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Database backups include all 17 tables but <strong>not</strong> screenshot image files.</li>
          <li>For a full backup including screenshots, run <code className="rounded bg-white/5 px-1 py-0.5 text-amber-300">bash scripts/backup.sh</code> on the server.</li>
          <li>Encrypted backups use AES-256-GCM with scrypt key derivation. The passphrase is never sent to the server — encryption happens server-side with the passphrase you provide.</li>
          <li>Every backup and restore is recorded in the Audit Trail.</li>
        </ul>
      </div>
    </div>
  );
}
