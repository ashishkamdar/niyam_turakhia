"use client";

import { useEffect, useState } from "react";
import { PinPad } from "./pin-pad";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "locked" | "unlocked">("loading");

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => setStatus(data.authenticated ? "unlocked" : "locked"))
      .catch(() => setStatus("locked"));
  }, []);

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
