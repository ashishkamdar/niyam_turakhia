"use client";

import { useState, useEffect, useRef } from "react";
import type { WhatsAppMessage } from "@/lib/types";

export function ChatThread({
  contactName,
  messages,
  onSendMessage,
  onBack,
}: {
  contactName: string;
  messages: WhatsAppMessage[];
  onSendMessage: (text: string) => void;
  onBack?: () => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSendMessage(text);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        {onBack && (
          <button onClick={onBack} className="text-gray-400 hover:text-white lg:hidden">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
        <div className="flex size-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
          {contactName.charAt(0)}
        </div>
        <span className="text-sm font-semibold text-white">{contactName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => {
          const isIncoming = m.direction === "incoming";
          const hasLock = m.is_lock;
          return (
            <div key={m.id} className={`flex ${isIncoming ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  hasLock
                    ? "bg-amber-600/20 outline outline-1 outline-amber-500/50"
                    : isIncoming
                      ? "bg-gray-800 text-gray-100"
                      : "bg-emerald-700 text-white"
                }`}
              >
                <p>
                  {hasLock ? highlightLock(m.message) : m.message}
                </p>
                <p className={`mt-1 text-[10px] ${hasLock ? "text-amber-400/70" : isIncoming ? "text-gray-500" : "text-emerald-300/70"}`}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {hasLock && " — DEAL LOCKED"}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="min-w-0 flex-1 rounded-full bg-gray-800 px-4 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:outline-1 focus:outline-amber-500"
          />
          <button
            onClick={handleSend}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function highlightLock(text: string): React.ReactNode {
  const parts = text.split(/(\block\b)/i);
  return parts.map((part, i) =>
    /^lock$/i.test(part) ? (
      <span key={i} className="font-bold text-amber-400">{part}</span>
    ) : (
      part
    )
  );
}
