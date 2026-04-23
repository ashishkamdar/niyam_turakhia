import type { Metadata } from "next";

/**
 * Trade Desk layout — completely isolated from the main PrismX app.
 *
 * No sidebar, no bottom nav, no price ticker, no FY selector, no
 * notifications, no search, no PrismX branding. Staff accessing
 * /portal/trade sees ONLY a clean trade entry interface branded
 * as "Jinyi Gold HK · Trade Desk". They have no idea the "mother
 * software" (PrismX) exists.
 *
 * Uses the SAME auth system (auth_pins → auth_sessions → nt_session
 * cookie) so PINs and sessions are shared. But the layout doesn't
 * render any navigation links to /review, /deals, /stock, etc.
 *
 * The /portal/ prefix is configured in Cloudflare for access control
 * so only registered users can reach this URL.
 */

export const metadata: Metadata = {
  title: "Jinyi Gold HK — Trade Desk",
  description: "Trade entry portal",
};

export default function TradeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
