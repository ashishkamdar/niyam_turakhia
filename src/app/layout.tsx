import type { Metadata } from "next";
import { AuthGate } from "@/components/auth-gate";
import { PriceTicker } from "@/components/price-ticker";
import { SidebarNav } from "@/components/sidebar-nav";
import { BottomNav } from "@/components/bottom-nav";
import { DealToast } from "@/components/deal-toast";
import { DemoProvider } from "@/components/demo-engine";
import { DemoIndicator } from "@/components/demo-indicator";
import "./globals.css";

export const metadata: Metadata = {
  title: "NT Precious Metals - MIS Dashboard",
  description: "Real-time profitability dashboard for precious metals trading",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <AuthGate>
          <DemoProvider>
            <DealToast />
            <DemoIndicator />
            <SidebarNav />
            <div className="overflow-x-hidden lg:pl-60">
              <PriceTicker />
              <main className="px-3 py-4 pb-20 sm:px-6 lg:px-8 lg:pb-6">{children}</main>
            </div>
            <BottomNav />
          </DemoProvider>
        </AuthGate>
      </body>
    </html>
  );
}
