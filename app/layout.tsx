import type { Metadata } from "next";
import "./globals.css";
import "./homepage.css";
import "./nexaris.css";
import "./motion.css";
import "./earn.css";
export const metadata: Metadata = {
  title: "freestock | Put DeFi earnings toward your stock picks",
  description:
    "Use the private USDG lending and Stock Token wallet pilot, or try the flow with practice money. Every real transaction requires your wallet approval.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="nexaris">
      <body>{children}</body>
    </html>
  );
}
