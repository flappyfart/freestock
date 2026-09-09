import type { Metadata } from 'next';
import './globals.css';
import './homepage.css';
import './nexaris.css';
import './motion.css';
import './earn.css';
import './flow.css';
import { WalletProvider } from './live/wallet-provider';
import { DemoProvider } from './demo/demo-provider';
export const metadata: Metadata = {
  metadataBase: new URL('https://tryfreestock.com'),
  title: {
    default: 'Freestock | Your yield. Your stock picks.',
    template: '%s | Freestock',
  },
  description:
    'Lend USDG on Robinhood Chain and put available gains toward stock tokens you choose. Get Agentic Lending recommendations and approve every transaction in your wallet.',
  applicationName: 'Freestock',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/brand/fs-icon.png', type: 'image/png', sizes: '1254x1254' },
    ],
    apple: [{ url: '/brand/fs-icon.png', sizes: '1254x1254' }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Freestock',
    title: 'Freestock | Your yield. Your stock picks.',
    description:
      'Lend USDG. Choose stock tokens for your gains. Stay in control with wallet-approved transactions.',
    images: [
      {
        url: '/brand/freestock-share.png',
        width: 1734,
        height: 907,
        alt: 'Freestock: Your yield. Your stock picks. Cobalt glass fs logo.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@tryfreestock',
    creator: '@tryfreestock',
    title: 'Freestock | Your yield. Your stock picks.',
    description:
      'USDG lending and stock-token purchases, guided by Agentic Lending and approved by your wallet.',
    images: ['/brand/freestock-share.png'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
