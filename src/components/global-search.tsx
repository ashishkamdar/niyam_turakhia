"use client";

/**
 * GlobalSearch — ⌘K (Mac) / Ctrl+K (Windows) search modal.
 *
 * Also accessible via the search-icon button in the top bar (for
 * mobile users who don't have keyboard shortcuts).
 *
 * Queries /api/search on every keystroke (debounced 300ms). Results
 * are grouped by type (Deals, Parties, Audit). Arrow keys navigate,
 * Enter selects, Escape closes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ResultItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

type ResultGroup = {
  group: string;
  icon: string;
  items: ResultItem[];
};

type SearchResponse = {
  results: ResultGroup[];
  query: string;
  total: number;
};

// ── Trigger button (mounted in PriceTicker) ──────────────────────────

export function GlobalSearchTrigger({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("prismx:open-search"))}
      aria-label="Search (⌘K)"
      title="Search (⌘K / Ctrl+K)"
      className={`flex items-center gap-1.5 rounded-md border border-white/10 bg-gray-900 px-2 py-1.5 text-xs text-gray-400 transition hover:bg-white/5 hover:text-white print:hidden ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden rounded bg-white/5 px-1 py-0.5 font-mono text-[9px] text-gray-500 sm:inline">
        {typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent) ? "⌘K" : "Ctrl+K"}
      </kbd>
    </button>
  );
}

// ── Search modal (mounted in layout) ─────────────────────────────────

export function GlobalSearchModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Flatten results for keyboard navigation
  const flatItems = results.flatMap((g) => g.items);

  // ── Open/close handlers ─────────────────────────────────────────
  const openSearch = useCallback(() => {
    setOpen(true);
    setQuery("");
    setResults([]);
    setSelectedIdx(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  // ── Keyboard shortcut: ⌘K / Ctrl+K ─────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) closeSearch();
        else openSearch();
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        closeSearch();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, openSearch, closeSearch]);

  // ── Custom event from the trigger button ────────────────────────
  useEffect(() => {
    function onCustom() { openSearch(); }
    window.addEventListener("prismx:open-search", onCustom);
    return () => window.removeEventListener("prismx:open-search", onCustom);
  }, [openSearch]);

  // ── Debounced search ────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`);
        const json: SearchResponse = await res.json();
        setResults(json.results);
        setTotal(json.total);
        setSelectedIdx(0);
      } catch { /* silent */ }
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  // ── Arrow key navigation ────────────────────────────────────────
  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatItems[selectedIdx]) {
      e.preventDefault();
      router.push(flatItems[selectedIdx].href);
      closeSearch();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] print:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeSearch}
      />

      {/* Modal */}
      <div className="relative mx-auto mt-[15vh] w-full max-w-lg px-4">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-gray-900 shadow-2xl">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5 shrink-0 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Search deals, parties, audit…"
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {loading && (
              <svg className="size-4 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M4 12a8 8 0 018-8" strokeLinecap="round" />
              </svg>
            )}
            <kbd className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-500">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {query.length >= 2 && results.length === 0 && !loading && (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No results for &quot;{query}&quot;
              </div>
            )}

            {query.length < 2 && (
              <div className="px-4 py-6 text-center text-xs text-gray-500">
                Type at least 2 characters to search across deals, parties, and audit entries.
              </div>
            )}

            {results.map((group) => (
              <div key={group.group}>
                <div className="sticky top-0 bg-gray-900/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 backdrop-blur">
                  {group.icon} {group.group}
                </div>
                <ul>
                  {group.items.map((item) => {
                    const flatIdx = flatItems.indexOf(item);
                    const isSelected = flatIdx === selectedIdx;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            router.push(item.href);
                            closeSearch();
                          }}
                          onMouseEnter={() => setSelectedIdx(flatIdx)}
                          className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition ${
                            isSelected ? "bg-amber-500/10" : "hover:bg-white/5"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className={`truncate text-sm ${isSelected ? "text-amber-200" : "text-white"}`}>
                              {item.title}
                            </div>
                            <div className="truncate text-[11px] text-gray-500">
                              {item.subtitle}
                            </div>
                          </div>
                          {isSelected && (
                            <kbd className="mt-0.5 shrink-0 rounded bg-white/5 px-1 py-0.5 text-[9px] text-gray-500">
                              Enter ↵
                            </kbd>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer */}
          {total > 0 && (
            <div className="border-t border-white/5 px-4 py-2 text-[10px] text-gray-500">
              {total} result{total === 1 ? "" : "s"} · ↑↓ navigate · Enter to open · Esc to close
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
