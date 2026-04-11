"use client";

import { useEffect, useRef } from "react";
import type { WhatsAppMessage } from "@/lib/types";

// ─── Compose input disabled until Meta verification lands ─────────────
// Keeping onSendMessage in the prop list (optional, unused for now) so
// re-enabling is a one-file revert: drop the read-only notice at the
// bottom and restore the <input> + handleSend block, the parent page
// still passes the handler. Do NOT delete the page-level handler or
// the /api/whatsapp POST path — the send-status columns and UI states
// all still work and should stay ready for when the WABA is verified.

export function ChatThread({
  contactName,
  messages,
  onBack,
}: {
  contactName: string;
  messages: WhatsAppMessage[];
  onSendMessage?: (text: string) => void;
  onBack?: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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

      {/* Input — disabled for the Niyam demo.
          Outbound messaging is blocked on Meta Business Manager asset
          permissions for the test number. Rather than show users a
          working-looking input that silently errors, the whole input
          is replaced with a read-only notice. When the real WABA
          comes online post-verification, revert this file or gate
          the notice on a meta_config flag. */}
      <div className="shrink-0 border-t border-white/10 px-3 py-3">
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/80">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4 shrink-0 text-amber-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 17.25h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="leading-relaxed">
            Read-only — outbound sending is paused until the WhatsApp
            Business account is fully verified on Meta&apos;s side.
            Inbound from staff continues to flow into the Review queue
            as normal.
          </div>
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
