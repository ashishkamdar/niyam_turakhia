"use client";

import type { WhatsAppContact } from "@/lib/types";

const AVATAR_COLORS: Record<string, string> = {
  "Mr. Chang": "bg-blue-600",
  "Karim & Co.": "bg-emerald-600",
  "Shah Brothers": "bg-amber-600",
  "Li Wei Trading": "bg-purple-600",
  "Patel Exports": "bg-rose-600",
};

function LockIcons({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" fill="currentColor" className="size-3 text-amber-400">
          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
        </svg>
      ))}
    </span>
  );
}

function ContactRow({
  c,
  isActive,
  onSelect,
  dimmed,
}: {
  c: WhatsAppContact;
  isActive: boolean;
  onSelect: (name: string) => void;
  dimmed?: boolean;
}) {
  const initial = c.contact_name.charAt(0).toUpperCase();
  const color = AVATAR_COLORS[c.contact_name] ?? "bg-gray-600";

  return (
    <button
      onClick={() => onSelect(c.contact_name)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
        isActive ? "bg-white/10" : "hover:bg-white/5"
      } ${dimmed ? "opacity-60" : ""}`}
    >
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${color} text-sm font-bold text-white`}>
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium text-white">{c.contact_name}</span>
            <LockIcons count={c.lock_count} />
          </div>
          {c.unread > 0 && (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
              {c.unread}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-gray-400">{c.lastMessage}</p>
      </div>
    </button>
  );
}

export function ContactList({
  contacts,
  selected,
  onSelect,
}: {
  contacts: WhatsAppContact[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  // Active: no locks, OR has new incoming messages after their last lock
  const active = contacts.filter((c) => c.lock_count === 0 || c.msgs_after_last_lock > 0);
  // Settled: has locks and no new incoming messages after last lock
  const settled = contacts.filter((c) => c.lock_count > 0 && c.msgs_after_last_lock === 0);

  return (
    <div>
      {active.length > 0 && (
        <div>
          <div className="px-3 pb-1 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              Active {active.length > 0 && `(${active.length})`}
            </p>
          </div>
          <div className="space-y-0.5">
            {active.map((c) => (
              <ContactRow key={c.contact_name} c={c} isActive={selected === c.contact_name} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      {settled.length > 0 && (
        <div>
          <div className="px-3 pb-1 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Locked Deals ({settled.length})
            </p>
          </div>
          <div className="space-y-0.5">
            {settled.map((c) => (
              <ContactRow key={c.contact_name} c={c} isActive={selected === c.contact_name} onSelect={onSelect} dimmed />
            ))}
          </div>
        </div>
      )}

      {contacts.length === 0 && (
        <p className="px-3 py-8 text-center text-sm text-gray-500">No conversations yet. Start the chat simulator.</p>
      )}
    </div>
  );
}
