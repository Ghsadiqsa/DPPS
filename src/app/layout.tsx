import type { Metadata } from 'next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'DPPS - Duplicate Payment Prevention System',
  description: 'Enterprise-grade duplicate payment prevention and recovery',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <SessionProvider session={session}>
          <QueryProvider>
            <AppLayout session={session}>
              {children}
            </AppLayout>
            <Toaster position="top-right" richColors />
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
