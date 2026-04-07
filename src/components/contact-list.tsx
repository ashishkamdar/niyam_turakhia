"use client";

import type { WhatsAppContact } from "@/lib/types";

const AVATAR_COLORS: Record<string, string> = {
  "Mr. Chang": "bg-blue-600",
  "Karim & Co.": "bg-emerald-600",
  "Shah Brothers": "bg-amber-600",
  "Li Wei Trading": "bg-purple-600",
  "Patel Exports": "bg-rose-600",
};

export function ContactList({
  contacts,
  selected,
  onSelect,
}: {
  contacts: WhatsAppContact[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {contacts.map((c) => {
        const initial = c.name.charAt(0).toUpperCase();
        const color = AVATAR_COLORS[c.name] ?? "bg-gray-600";
        const isActive = selected === c.name;
        return (
          <button
            key={c.name}
            onClick={() => onSelect(c.name)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
              isActive ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${color} text-sm font-bold text-white`}>
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{c.name}</span>
                {c.unread > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-gray-400">{c.lastMessage}</p>
            </div>
          </button>
        );
      })}
      {contacts.length === 0 && (
        <p className="px-3 py-8 text-center text-sm text-gray-500">No conversations yet. Start the chat simulator.</p>
      )}
    </div>
  );
}
