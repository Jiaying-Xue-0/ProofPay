import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from '@/app/providers';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'ProofPay - Web3 Invoice & Receipt Generator',
  description: 'Generate professional invoices and receipts for your Web3 transactions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo-proofpay-icon.png" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
