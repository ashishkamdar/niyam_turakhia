"use client";

/**
 * ThemeProvider — global light/dark switch.
 *
 * The design decision here is deliberately minimal: dark mode is the
 * star, and light mode is an opt-in for users who prefer it. So
 * instead of rewriting every component to use `dark:` variants,
 * we flip theme by overriding Tailwind's gray-palette CSS variables
 * in a `.light` scope on <html>. See globals.css for the override
 * block. Components using `bg-gray-950`, `text-white`, etc. pick up
 * the new values automatically.
 *
 * Defaults to "dark" (matches the pre-toggle behaviour). Persists to
 * localStorage so a refresh doesn't bounce the user back. Tries to
 * match `prefers-color-scheme` on the very first visit only — after
 * that the user's explicit choice wins.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "prismx_theme_v1";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  // Keep the .dark class in place when dark (Tailwind's default dark
  // variant reads from it) AND add .light when light so our CSS
  // overrides in globals.css can target it. html can have both classes
  // at different times, never simultaneously.
  html.classList.toggle("dark", t === "dark");
  html.classList.toggle("light", t === "light");
  // Update color-scheme so native form controls, scrollbars, and the
  // browser's own UI chrome flip too.
  html.style.colorScheme = t;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize with "dark" on first render to match the server-rendered
  // HTML (layout.tsx sets className="dark" by default). The useEffect
  // below reconciles with localStorage / prefers-color-scheme after
  // hydration — avoids a hydration mismatch warning.
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    // Read persisted choice first. If absent, fall back to the OS
    // preference via prefers-color-scheme. Keeps first-time visits
    // honest without forcing light mode on our dark-first design.
    let resolved: Theme = "dark";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        resolved = stored;
      } else if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
        resolved = "light";
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — stay dark.
    }
    setThemeState(resolved);
    applyTheme(resolved);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error("useTheme must be used inside a <ThemeProvider>");
    }
    return { theme: "dark", setTheme: () => {}, toggle: () => {} };
  }
  return ctx;
}
