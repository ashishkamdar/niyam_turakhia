import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NT Precious Metals - MIS Dashboard",
  description: "Real-time profitability dashboard for precious metals trading",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
