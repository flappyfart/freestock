import type { Metadata } from "next";
import "./globals.css";
import "./homepage.css";
import "./nexaris.css";
import "./motion.css";
import "./earn.css";
import "./flow.css";
import { WalletProvider } from "./live/wallet-provider";
import { DemoProvider } from "./demo/demo-provider";
export const metadata: Metadata = {
  title: "freestock | Agentic Lending, your stock picks",
  description:
    "Set a lending plan, check available gains and review stock purchases with Agentic Lending. Rule-based recommendations for your live lending account; every transaction needs your approval.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="nexaris">
      <body>
        <WalletProvider>
          <DemoProvider>{children}</DemoProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
