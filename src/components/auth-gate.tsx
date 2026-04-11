"use client";

import { useEffect, useState } from "react";
import { PinPad } from "./pin-pad";

// How often to ping /api/auth while the tab is open. Each ping updates
// auth_sessions.last_seen on the server so the /users page can show
// "Last active: just now" for genuinely-present users. 30 seconds is
// well under the 2-minute active window used by /api/sessions, so one
// or two dropped pings (e.g. sleeping iOS tab) is tolerable.
const HEARTBEAT_INTERVAL_MS = 30_000;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "locked" | "unlocked">("loading");

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => setStatus(data.authenticated ? "unlocked" : "locked"))
      .catch(() => setStatus("locked"));
  }, []);

  // Heartbeat — only runs while the user is actually unlocked. Silently
  // bumps last_seen. If the session is deleted server-side (admin removed
  // the PIN), the next response returns authenticated: false and we flip
  // back to the lock screen.
  useEffect(() => {
    if (status !== "unlocked") return;
    const id = setInterval(() => {
      fetch("/api/auth")
        .then((r) => r.json())
        .then((data) => {
          if (!data.authenticated) setStatus("locked");
        })
        .catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="size-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  if (status === "locked") {
    return <PinPad onSuccess={() => setStatus("unlocked")} />;
  }

  return <>{children}</>;
}
