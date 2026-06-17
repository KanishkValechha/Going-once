import type { Metadata } from 'next';
import { Archivo, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ConvexClientProvider } from '@/components/ConvexClientProvider';
import { Toaster } from '@/components/ui/sonner';
import { withAuth } from '@workos-inc/authkit-nextjs';

// Clean grotesque for everything — headings lean on weight, not all-caps.
const archivo = Archivo({
  variable: '--font-sans',
  subsets: ['latin'],
});

// Tabular mono for capability links and monospace fields.
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Going Once — Live Auction',
  description: 'Real-time control and display for offline sports auctions.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { accessToken } = await withAuth();
  return (
    <html lang="en">
      <body
        className={`${archivo.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ConvexClientProvider expectAuth={!!accessToken}>{children}</ConvexClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
