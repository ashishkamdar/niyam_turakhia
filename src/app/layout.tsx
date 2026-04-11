import type { Metadata, Viewport } from "next";
import { AuthGate } from "@/components/auth-gate";
import { PriceTicker } from "@/components/price-ticker";
import { SidebarNav } from "@/components/sidebar-nav";
import { BottomNav } from "@/components/bottom-nav";
import { DealToast } from "@/components/deal-toast";
import { DemoProvider } from "@/components/demo-engine";
import { DemoIndicator } from "@/components/demo-indicator";
import { FyProvider } from "@/components/fy-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrismX — Precious Metals MIS",
  description: "Real-time profitability dashboard for precious metals trading",
  applicationName: "PrismX",
  appleWebApp: {
    capable: true,
    title: "PrismX",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#030712",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <ThemeProvider>
          <AuthGate>
            <FyProvider>
              <DemoProvider>
                <DealToast />
                <DemoIndicator />
                <SidebarNav />
                <div className="overflow-x-hidden lg:pl-60 print:lg:pl-0">
                  <PriceTicker />
                  <main className="px-3 py-4 pb-20 sm:px-6 lg:px-8 lg:pb-6 print:px-0 print:py-0 print:pb-0">{children}</main>
                </div>
                <BottomNav />
              </DemoProvider>
            </FyProvider>
          </AuthGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
