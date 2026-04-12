import Link from "next/link";

/**
 * Custom 404 page — renders when no route matches. Branded with
 * PrismX styling so it doesn't look like a generic Next.js error.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl font-bold text-amber-400/30">404</div>
      <h1 className="mt-4 text-xl font-semibold text-white">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-gray-400">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Check the URL or go back to the dashboard.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
