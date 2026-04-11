"use client";

/**
 * ReportLetterhead — branded header to print at the top of any PrismX report.
 *
 * Shows the PrismX logo + "Precious Metals Trading" tagline on the left, and
 * a "CONFIDENTIAL / date / time" block on the right. Below that, a bold
 * report title and optional subtitle (e.g. the period being reported).
 *
 * Renders cleanly in BOTH screen view (dark theme) and print view (white
 * paper + black text). The `print:` Tailwind variants flip colours for print.
 *
 * Reusable: any page can wrap its content with this + add a Print button
 * that calls window.print(). Designed for /reports today but intended to be
 * dropped into /stock, /deals, /money-flow, etc. as needed.
 */
interface ReportLetterheadProps {
  title: string;
  subtitle?: string;
}

export function ReportLetterhead({ title, subtitle }: ReportLetterheadProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="report-letterhead mb-6">
      <div className="flex items-start justify-between gap-4 border-b border-amber-500/40 pb-4 print:border-amber-700">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/prismx-logo.png"
            alt="PrismX"
            className="h-12 w-auto print:h-14"
          />
          <div className="hidden text-[10px] uppercase tracking-wider text-gray-500 print:text-gray-700 sm:block">
            <div className="font-semibold">Precious Metals Trading</div>
            <div>Bullion Management Reports</div>
          </div>
        </div>
        <div className="text-right text-[10px] uppercase tracking-wider text-gray-500 print:text-gray-700">
          <div className="font-bold text-amber-400 print:text-amber-700">Confidential</div>
          <div className="mt-0.5">{dateStr}</div>
          <div>Generated {timeStr}</div>
        </div>
      </div>
      <div className="mt-4">
        <h1 className="text-2xl font-bold text-white print:text-black">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-400 print:text-gray-600">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
