import type { Metadata } from "next";
import { PriceTicker } from "@/components/price-ticker";
import { SidebarNav } from "@/components/sidebar-nav";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "NT Precious Metals - MIS Dashboard",
  description: "Real-time profitability dashboard for precious metals trading",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <SidebarNav />
        <div className="lg:pl-60">
          <PriceTicker />
          <main className="px-4 py-6 pb-20 sm:px-6 lg:px-8 lg:pb-6">{children}</main>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
