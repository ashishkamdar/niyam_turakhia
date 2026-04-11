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
    <div className="flex h-full max-w-full flex-col overflow-hidden">
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
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((m) => {
          const isIncoming = m.direction === "incoming";
          // IMPORTANT: coerce to boolean. SQLite stores is_lock as an
          // INTEGER (0/1), not a bool — left as-is it rendered literal
          // "0" characters next to every timestamp via React's `&&`
          // short-circuit evaluation.
          const hasLock = Boolean(m.is_lock);
          // Three outbound states now: real send succeeded (wamid +
          // send_status = 'sent'), real send failed (send_status =
          // 'failed', error captured), or legacy row (no send_status
          // at all). Legacy rows predate the Meta wire-up and still
          // show double ticks so the existing simulator history isn't
          // suddenly flagged as broken.
          const sendFailed = !isIncoming && m.send_status === "failed";
          return (
            <div key={m.id} className={`flex ${isIncoming ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  sendFailed
                    ? "bg-rose-900/40 outline outline-1 outline-rose-500/50"
                    : hasLock
                      ? "bg-amber-600/20 outline outline-1 outline-amber-500/50"
                      : isIncoming
                        ? "bg-gray-800 text-gray-100"
                        : "bg-emerald-700 text-white"
                }`}
              >
                <p>
                  {hasLock ? highlightLock(m.message) : m.message}
                </p>
                <p className={`mt-1 flex items-center gap-1 text-[10px] ${
                  sendFailed
                    ? "text-rose-300"
                    : hasLock
                      ? "text-amber-400/70"
                      : isIncoming
                        ? "text-gray-500"
                        : "text-emerald-300/70"
                }`}>
                  <span>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {hasLock ? <span>· DEAL LOCKED</span> : null}
                  {/* Outbound status indicator. Failed = red exclamation
                      with the raw Meta error as a tooltip so users can
                      diagnose 24h-window / not-in-allow-list issues
                      without opening devtools. Otherwise double ticks. */}
                  {!isIncoming
                    ? sendFailed
                      ? <FailedIndicator error={m.send_error ?? "Send failed"} />
                      : <DeliveryTicks className={hasLock ? "text-amber-300" : "text-emerald-200"} />
                    : null}
                </p>
                {sendFailed && m.send_error ? (
                  <p className="mt-1 max-w-full break-words text-[10px] text-rose-300/80">
                    {m.send_error}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/10 px-2 py-2">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="min-w-0 flex-1 rounded-full bg-gray-800 px-3 py-2 text-base text-white placeholder:text-gray-500 outline-none"
          />
          <button
            onClick={handleSend}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white active:bg-emerald-500"
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

/**
 * Red exclamation shown when a real outbound send was rejected by
 * Meta (e.g. 24-hour customer-service window expired, recipient not
 * in the test allow-list, missing credentials). The raw error string
 * is surfaced both as a tooltip and as a second subtitle line below
 * the timestamp so users can diagnose without opening devtools.
 */
function FailedIndicator({ error }: { error: string }) {
  return (
    <span
      title={error}
      aria-label="Send failed"
      className="ml-0.5 inline-flex size-3 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white"
    >
      !
    </span>
  );
}

/**
 * WhatsApp-style double-tick delivery indicator for outgoing bubbles.
 * In the real app these would flip through sent → delivered → read
 * states; for the demo simulator every outgoing message is "delivered"
 * the moment it persists, so the ticks render once and stay put.
 */
function DeliveryTicks({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 11"
      fill="none"
      aria-label="Delivered"
      className={`ml-0.5 inline-block h-2.5 w-auto ${className}`}
    >
      {/* Back tick */}
      <path
        d="M1 5.5 L4.2 8.7 L10.5 2.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Front tick, offset to the right */}
      <path
        d="M5.5 5.5 L8.7 8.7 L15 2.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
