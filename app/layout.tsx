import type { Metadata } from "next";
import "./globals.css";
import "./homepage.css";
import "./nexaris.css";
import "./motion.css";
import "./earn.css";
export const metadata: Metadata = {
  title: "freestock | Put DeFi earnings toward your stock picks",
  description:
    "Explore lending, model LP strategies, and choose stock-token baskets or compounding for your earnings. Practice funds only; live deposits and trading are not enabled.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="nexaris">
      <body>{children}</body>
    </html>
  );
}
