"use client";

/**
 * FyProvider — global financial-year state.
 *
 * Wraps the app at the layout level so any page/component can read
 * the currently-selected FY without prop-drilling. The provider:
 *
 *   1. Fetches /api/settings once on mount to learn the configured
 *      FY start (MM-DD). Falls back to the default (04-01) if the
 *      request fails — the app keeps working even with no settings.
 *   2. Derives the list of selectable FYs (current + 5 prior).
 *   3. Reads the last-selected FY label from localStorage so the
 *      user's choice persists across page loads.
 *   4. Exposes { fy, fys, fyStart, setFy, refresh } via useFy().
 *
 * Design notes:
 *
 * • The list of FYs is cached in state, not recomputed on every
 *   render, because deriving a FinancialYear involves Date math
 *   that's trivially cheap but clutters React profiling.
 *
 * • `refresh()` is exposed so the Settings page can re-pull after
 *   the user saves a new FY start — avoids a full page reload.
 *
 * • The storage key includes a version suffix in case we ever
 *   change the label format; old localStorage entries can be
 *   migrated or ignored without users seeing stale selections.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_FY_START,
  deriveFy,
  listFinancialYears,
  type FinancialYear,
} from "@/lib/financial-year";

const STORAGE_KEY = "prismx_selected_fy_v1";

type FyContextValue = {
  /** The currently-selected FY window. */
  fy: FinancialYear;
  /** All selectable FYs (current + 5 prior, newest first). */
  fys: FinancialYear[];
  /** The configured FY start (MM-DD string). */
  fyStart: string;
  /** Select a different FY by label. No-op if label isn't in fys. */
  setFy: (label: string) => void;
  /** Re-fetch /api/settings and rebuild the FY list. */
  refresh: () => void;
};

const FyContext = createContext<FyContextValue | null>(null);

export function FyProvider({ children }: { children: React.ReactNode }) {
  const [fyStart, setFyStart] = useState<string>(DEFAULT_FY_START);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Load the persisted selection once on mount. Wrapped in a try
  // block so private-mode Safari (where localStorage can throw) never
  // crashes the app. If nothing is persisted, selectedLabel stays
  // null and the derived `fy` defaults to "current".
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedLabel(stored);
    } catch {
      // ignore — localStorage not available
    }
  }, []);

  const refresh = useCallback(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const next = data?.settings?.financial_year_start ?? DEFAULT_FY_START;
        setFyStart(next);
      })
      .catch(() => {
        // Silent — the default fyStart is already usable.
      })
      .finally(() => setBootstrapped(true));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Derive the FY list from the current fyStart. useMemo keeps this
  // stable across renders that don't change fyStart — cheap, but
  // avoids unnecessary churn in consumers that depend on `fys`.
  const fys = useMemo(() => listFinancialYears(fyStart, 6), [fyStart]);

  // Resolve the selected FY: if the persisted label matches one in
  // the list, use it; otherwise fall back to the "current" FY (which
  // is always fys[0] per listFinancialYears' contract).
  const fy = useMemo<FinancialYear>(() => {
    if (selectedLabel) {
      const match = fys.find((f) => f.label === selectedLabel);
      if (match) return match;
    }
    return fys[0] ?? deriveFy(fyStart);
  }, [selectedLabel, fys, fyStart]);

  const setFy = useCallback((label: string) => {
    setSelectedLabel(label);
    try {
      window.localStorage.setItem(STORAGE_KEY, label);
    } catch {
      // ignore
    }
  }, []);

  // Don't gate rendering on bootstrap — consumers get the default FY
  // immediately and the list refreshes transparently once /api/settings
  // responds. Only the Settings page's edit form needs to care about
  // the bootstrap state.
  void bootstrapped;

  const value = useMemo<FyContextValue>(
    () => ({ fy, fys, fyStart, setFy, refresh }),
    [fy, fys, fyStart, setFy, refresh]
  );

  return <FyContext.Provider value={value}>{children}</FyContext.Provider>;
}

/**
 * Consumer hook. Throws during development if called outside an
 * FyProvider so the mistake is obvious; production builds get a
 * zero-value fallback that behaves as "current FY, default start".
 */
export function useFy(): FyContextValue {
  const ctx = useContext(FyContext);
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error("useFy must be used inside an <FyProvider>");
    }
    // Best-effort fallback so a production page can't blank-screen
    // due to a missing provider higher up the tree.
    const fys = listFinancialYears(DEFAULT_FY_START, 6);
    return {
      fy: fys[0],
      fys,
      fyStart: DEFAULT_FY_START,
      setFy: () => {},
      refresh: () => {},
    };
  }
  return ctx;
}
