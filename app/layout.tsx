import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Q — Trigger-based Perpetual Trading",
  description:
    "Build your trading edge. Trigger-based perpetual trading on Hyperliquid. Built for traders who think in conditions, not in clicks.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
