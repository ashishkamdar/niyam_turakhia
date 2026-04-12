"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { ReportLetterhead } from "@/components/report-letterhead";
import { useFy } from "@/components/fy-provider";
import { intersectFy } from "@/lib/financial-year";

type AuditEntry = {
  id: string;
  timestamp: string;
  actor_label: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  summary: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

type AuditResponse = {
  entries: AuditEntry[];
  count: number;
  actors: string[];
  actions: string[];
};

const ACTION_COLORS: Record<string, string> = {
  approve_deal: "bg-emerald-500/10 text-emerald-300",
  reject_deal: "bg-rose-500/10 text-rose-300",
  edit_deal: "bg-amber-500/10 text-amber-300",
  dispatch: "bg-sky-500/10 text-sky-300",
  party_create: "bg-violet-500/10 text-violet-300",
  party_update: "bg-violet-500/10 text-violet-300",
  party_deactivate: "bg-rose-500/10 text-rose-300",
  party_bulk_upload: "bg-sky-500/10 text-sky-300",
  pin_create: "bg-gray-500/10 text-gray-300",
  pin_update: "bg-gray-500/10 text-gray-300",
  pin_delete: "bg-rose-500/10 text-rose-300",
  login: "bg-emerald-500/10 text-emerald-300",
  logout: "bg-gray-500/10 text-gray-300",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AuditPage() {
  const { fy } = useFy();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [actorFilter, setActorFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { from, to } = intersectFy(fy, null, null);
    const params = new URLSearchParams({ from, to, limit: "200" });
    if (actorFilter) params.set("actor", actorFilter);
    if (actionFilter) params.set("action", actionFilter);
    try {
      const res = await fetch(`/api/audit?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch {
      // keep stale
    }
  }, [fy.fromIso, fy.toIso, actorFilter, actionFilter]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 10_000);
    return () => clearInterval(poll);
  }, [load]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4">
      <ReportLetterhead
        title="Audit Trail"
        subtitle={`${fy.label} · ${data?.count ?? 0} entries`}
      />

      {/* Filters — hidden in print */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Actor</label>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="rounded border border-white/10 bg-gray-900 px-2 py-1.5 text-xs text-white focus:border-amber-500/50 focus:outline-none"
          >
            <option value="">All</option>
            {(data?.actors ?? []).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-wider text-gray-500">Action</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded border border-white/10 bg-gray-900 px-2 py-1.5 text-xs text-white focus:border-amber-500/50 focus:outline-none"
          >
            <option value="">All</option>
            {(data?.actions ?? []).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
        >
          Print
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {data?.entries.length === 0 && (
          <div className="rounded-lg border border-white/5 bg-gray-900 p-8 text-center text-sm text-gray-500">
            No audit entries in this range.
          </div>
        )}
        {data?.entries.map((e) => {
          const isExpanded = expanded.has(e.id);
          const colorClass = ACTION_COLORS[e.action] ?? "bg-gray-500/10 text-gray-300";
          return (
            <div key={e.id} className="rounded-lg border border-white/5 bg-gray-900 px-4 py-3 print:border-gray-300 print:bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${colorClass}`}>
                    {e.action.replace(/_/g, " ")}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-white print:text-black">{e.summary}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-gray-500 print:text-gray-600">
                      <span>{formatTime(e.timestamp)}</span>
                      {e.actor_label && (
                        <span>by <span className="font-semibold text-amber-300 print:text-amber-800">{e.actor_label}</span></span>
                      )}
                      {e.target_id && (
                        <span className="font-mono text-gray-600">#{e.target_id.slice(0, 8)}</span>
                      )}
                    </div>
                  </div>
                </div>
                {(e.old_values || e.new_values || e.metadata) && (
                  <button
                    onClick={() => toggleExpand(e.id)}
                    className="shrink-0 rounded border border-white/10 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:bg-white/5 print:hidden"
                  >
                    {isExpanded ? "Hide" : "Details"}
                  </button>
                )}
              </div>
              {isExpanded && (
                <div className="mt-3 space-y-2 rounded-md border border-white/5 bg-gray-950 p-3 font-mono text-[11px]">
                  {e.old_values && (
                    <div>
                      <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-rose-400">Before</div>
                      <pre className="overflow-x-auto text-gray-400">{JSON.stringify(e.old_values, null, 2)}</pre>
                    </div>
                  )}
                  {e.new_values && (
                    <div>
                      <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400">After</div>
                      <pre className="overflow-x-auto text-gray-300">{JSON.stringify(e.new_values, null, 2)}</pre>
                    </div>
                  )}
                  {e.metadata && (
                    <div>
                      <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-sky-400">Metadata</div>
                      <pre className="overflow-x-auto text-gray-400">{JSON.stringify(e.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
