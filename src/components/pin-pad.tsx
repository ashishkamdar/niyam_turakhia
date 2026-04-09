"use client";

import { useState } from "react";

export function PinPad({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function checkPin(fullPin: string) {
    setChecking(true);
    setError(false);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: fullPin }),
    });
    if (res.ok) {
      onSuccess();
    } else {
      setError(true);
      setPin("");
    }
    setChecking(false);
  }

  function handleDigit(digit: string) {
    if (checking) return;
    setError(false);
    const next = pin + digit;
    setPin(next);
    if (next.length === 6) {
      checkPin(next);
    }
  }

  function handleDelete() {
    if (checking) return;
    setPin((p) => p.slice(0, -1));
    setError(false);
  }

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-xs">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-amber-400">PrismX</h1>
          <p className="mt-2 text-sm text-gray-400">Enter PIN to continue</p>
        </div>

        {/* PIN dots */}
        <div className="mb-6 flex justify-center gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`size-4 rounded-full transition-all ${
                error
                  ? "bg-rose-500"
                  : i < pin.length
                    ? "bg-amber-400"
                    : "bg-gray-700"
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="mb-4 text-center text-sm text-rose-400">Wrong PIN. Try again.</p>
        )}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3">
          {digits.map((d, i) => {
            if (d === "") return <div key={i} />;
            if (d === "del") {
              return (
                <button
                  key={i}
                  onClick={handleDelete}
                  className="flex h-16 items-center justify-center rounded-xl bg-gray-800/50 text-gray-400 active:bg-gray-700"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.374-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33z" />
                  </svg>
                </button>
              );
            }
            return (
              <button
                key={i}
                onClick={() => handleDigit(d)}
                disabled={checking}
                className="flex h-16 items-center justify-center rounded-xl bg-gray-800/50 text-2xl font-medium text-white transition active:bg-gray-700 disabled:opacity-50"
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
