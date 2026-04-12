"use client";

/**
 * Global error boundary — renders when a page component throws during
 * rendering. Branded with PrismX styling.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl font-bold text-rose-400/30">500</div>
      <h1 className="mt-4 text-xl font-semibold text-white">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-sm text-sm text-gray-400">
        An unexpected error occurred. Try refreshing the page. If the
        problem persists, contact your administrator.
      </p>
      {error.message && (
        <p className="mt-2 max-w-md rounded bg-rose-500/10 px-3 py-1.5 font-mono text-xs text-rose-300">
          {error.message}
        </p>
      )}
      <button
        onClick={reset}
        className="mt-6 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500"
      >
        Try again
      </button>
    </div>
  );
}
