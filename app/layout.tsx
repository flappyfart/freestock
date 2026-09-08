import type { Metadata } from "next";
import "./globals.css";
import "./dark-green.css";
import "./homepage.css";
export const metadata: Metadata = {
  title: "freestock | Save for a chance to win stock prizes",
  description:
    "Explore freestock: a private, simulated savings pool where yield funds stock prizes.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="forest">
      <body>{children}</body>
    </html>
  );
}
