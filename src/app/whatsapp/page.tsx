"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ContactList } from "@/components/contact-list";
import { ChatThread } from "@/components/chat-thread";
import type { WhatsAppMessage, WhatsAppContact } from "@/lib/types";
import { CHAT_SCRIPTS } from "@/lib/chat-scripts";

export default function WhatsAppPage() {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [simRunning, setSimRunning] = useState(false);
  const simActiveRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scriptProgress = useRef<Map<string, number>>(new Map());

  const loadContacts = useCallback(() => {
    fetch("/api/whatsapp").then((r) => r.json()).then(setContacts).catch(() => {});
  }, []);

  const loadMessages = useCallback((contact: string) => {
    fetch(`/api/whatsapp?contact=${encodeURIComponent(contact)}`)
      .then((r) => r.json())
      .then(setMessages)
      .catch(() => {});
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);
  useEffect(() => {
    if (selected) loadMessages(selected);
  }, [selected, loadMessages]);

  // Poll for new messages
  useEffect(() => {
    const poll = setInterval(() => {
      loadContacts();
      if (selected) loadMessages(selected);
    }, 2000);
    return () => clearInterval(poll);
  }, [selected, loadContacts, loadMessages]);

  // Simulator using setTimeout chain for random delays
  function scheduleNextMessage() {
    if (!simActiveRef.current) return;

    const active = CHAT_SCRIPTS.filter((s) => {
      const progress = scriptProgress.current.get(s.contact_name) ?? 0;
      return progress < s.messages.length;
    });

    if (active.length === 0) {
      simActiveRef.current = false;
      setSimRunning(false);
      return;
    }

    const delay = Math.floor(Math.random() * 5000) + 3000;
    timeoutRef.current = setTimeout(async () => {
      if (!simActiveRef.current) return;

      const script = active[Math.floor(Math.random() * active.length)];
      const idx = scriptProgress.current.get(script.contact_name) ?? 0;
      const msg = script.messages[idx];
      const isLockMessage = /\block\b/i.test(msg.text);

      try {
        await fetch("/api/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contact_name: script.contact_name,
            contact_location: script.contact_location,
            direction: msg.direction,
            message: msg.text,
            ...(isLockMessage && script.locks
              ? {
                  metal: script.metal,
                  purity: script.purity,
                  quantity_grams: script.quantity_grams,
                  price_per_oz: script.price_per_oz,
                  deal_direction: script.contact_location === "hong_kong" ? "sell" : "buy",
                }
              : {}),
          }),
        });
        scriptProgress.current.set(script.contact_name, idx + 1);
      } catch {
        // ignore fetch errors, keep going
      }

      scheduleNextMessage();
    }, delay);
  }

  function startSimulator() {
    simActiveRef.current = true;
    setSimRunning(true);
    scriptProgress.current = new Map();
    CHAT_SCRIPTS.forEach((s) => scriptProgress.current.set(s.contact_name, 0));
    scheduleNextMessage();
  }

  function stopSimulator() {
    simActiveRef.current = false;
    setSimRunning(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      simActiveRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleSendMessage(text: string) {
    if (!selected) return;
    const contact = contacts.find((c) => c.contact_name === selected);
    try {
      await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: selected,
          contact_location: contact?.contact_location ?? "uae",
          direction: "outgoing",
          message: text,
        }),
      });
      loadMessages(selected);
      loadContacts();
    } catch {
      // ignore
    }
  }

  const showThread = selected !== null;

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 14rem)" }}>
      {/* Header with simulator toggle */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <h1 className="text-lg font-semibold text-white">WhatsApp</h1>
          <p className="text-xs text-gray-400">Deal conversations</p>
        </div>
        <button
          onClick={simRunning ? stopSimulator : startSimulator}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition ${
            simRunning
              ? "bg-rose-600 text-white hover:bg-rose-500"
              : "bg-emerald-600 text-white hover:bg-emerald-500"
          }`}
        >
          <div className={`size-2 rounded-full ${simRunning ? "animate-pulse bg-white" : "bg-emerald-300"}`} />
          {simRunning ? "Stop Chats" : "Start Chats"}
        </button>
      </div>

      {/* Mobile: show list OR thread (not both). Desktop: side by side */}
      <div className="relative flex-1 overflow-hidden rounded-lg outline outline-1 outline-white/10">
        {/* Contact list */}
        <div className={`absolute inset-0 overflow-y-auto border-r border-white/10 bg-gray-900 lg:relative lg:float-left lg:h-full lg:w-80 ${showThread ? "hidden lg:block" : "block"}`}>
          <ContactList contacts={contacts} selected={selected} onSelect={setSelected} />
        </div>
        {/* Chat thread */}
        <div className={`absolute inset-0 bg-gray-950 lg:relative lg:ml-80 lg:h-full ${showThread ? "block" : "hidden lg:block"}`}>
          {selected ? (
            <ChatThread
              contactName={selected}
              messages={messages}
              onSendMessage={handleSendMessage}
              onBack={() => setSelected(null)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-500">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
