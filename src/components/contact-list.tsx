"use client";

import type { WhatsAppContact } from "@/lib/types";

const AVATAR_COLORS: Record<string, string> = {
  "Mr. Chang": "bg-blue-600",
  "Karim & Co.": "bg-emerald-600",
  "Shah Brothers": "bg-amber-600",
  "Li Wei Trading": "bg-purple-600",
  "Patel Exports": "bg-rose-600",
};

function ContactRow({
  c,
  isActive,
  onSelect,
}: {
  c: WhatsAppContact;
  isActive: boolean;
  onSelect: (name: string) => void;
}) {
  const initial = c.contact_name.charAt(0).toUpperCase();
  const color = AVATAR_COLORS[c.contact_name] ?? "bg-gray-600";
  const isLocked = c.has_lock > 0;

  return (
    <button
      onClick={() => onSelect(c.contact_name)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
        isActive ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <div className="relative shrink-0">
        <div className={`flex size-10 items-center justify-center rounded-full ${isLocked ? "bg-amber-600/30" : color} text-sm font-bold text-white`}>
          {initial}
        </div>
        {isLocked && (
          <div className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-2.5 text-white">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={`truncate text-sm font-medium ${isLocked ? "text-amber-200" : "text-white"}`}>{c.contact_name}</span>
          {c.unread > 0 && !isLocked && (
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
  const active = contacts.filter((c) => !c.has_lock || c.has_lock === 0);
  const locked = contacts.filter((c) => c.has_lock > 0);

  return (
    <div>
      {/* Active negotiations */}
      {active.length > 0 && (
        <div>
          <div className="px-3 pb-1 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Active</p>
          </div>
          <div className="space-y-0.5">
            {active.map((c) => (
              <ContactRow key={c.contact_name} c={c} isActive={selected === c.contact_name} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      {/* Locked deals */}
      {locked.length > 0 && (
        <div>
          <div className="px-3 pb-1 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Locked Deals</p>
          </div>
          <div className="space-y-0.5 opacity-75">
            {locked.map((c) => (
              <ContactRow key={c.contact_name} c={c} isActive={selected === c.contact_name} onSelect={onSelect} />
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
