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
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scriptProgress = useRef<Map<string, number>>(new Map());

  const loadContacts = useCallback(() => {
    fetch("/api/whatsapp").then((r) => r.json()).then(setContacts);
  }, []);

  const loadMessages = useCallback((contact: string) => {
    fetch(`/api/whatsapp?contact=${encodeURIComponent(contact)}`)
      .then((r) => r.json())
      .then(setMessages);
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

  // Simulator
  function startSimulator() {
    setSimRunning(true);
    scriptProgress.current = new Map();
    CHAT_SCRIPTS.forEach((s) => scriptProgress.current.set(s.contact_name, 0));

    simRef.current = setInterval(() => {
      // Pick a random script that hasn't finished
      const active = CHAT_SCRIPTS.filter((s) => {
        const progress = scriptProgress.current.get(s.contact_name) ?? 0;
        return progress < s.messages.length;
      });
      if (active.length === 0) {
        stopSimulator();
        return;
      }
      const script = active[Math.floor(Math.random() * active.length)];
      const idx = scriptProgress.current.get(script.contact_name) ?? 0;
      const msg = script.messages[idx];
      const isLockMessage = /\block\b/i.test(msg.text);

      fetch("/api/whatsapp", {
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
    }, Math.random() * 5000 + 3000); // 3-8 seconds
  }

  function stopSimulator() {
    setSimRunning(false);
    if (simRef.current) clearInterval(simRef.current);
    simRef.current = null;
  }

  async function handleSendMessage(text: string) {
    if (!selected) return;
    const contact = contacts.find((c) => c.name === selected);
    await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_name: selected,
        contact_location: contact?.location ?? "uae",
        direction: "outgoing",
        message: text,
      }),
    });
    loadMessages(selected);
    loadContacts();
  }

  // Mobile: show chat thread full screen when selected
  const showThread = selected !== null;

  return (
    <div className="flex h-[calc(100vh-theme(spacing.32))] flex-col">
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

      {/* Desktop: two panel, Mobile: list or thread */}
      <div className="flex flex-1 overflow-hidden rounded-lg outline outline-1 outline-white/10">
        {/* Contact list — hidden on mobile when thread is open */}
        <div className={`w-full shrink-0 overflow-y-auto border-r border-white/10 bg-gray-900 lg:block lg:w-80 ${showThread ? "hidden" : "block"}`}>
          <ContactList contacts={contacts} selected={selected} onSelect={setSelected} />
        </div>

        {/* Chat thread */}
        <div className={`flex-1 bg-gray-950 ${showThread ? "block" : "hidden lg:block"}`}>
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
