import type { Metadata } from "next";
import "./globals.css";
import "./homepage.css";
import "./nexaris.css";
import "./motion.css";
export const metadata: Metadata = {
  title: "freestock | Stock-token prizes for eligible non-US users",
  description:
    "Explore the freestock practice demo. Planned for eligible non-US users, with USDG pool earnings funding stock-token prizes. Real deposits are not available.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="nexaris">
      <body>{children}</body>
    </html>
  );
}
