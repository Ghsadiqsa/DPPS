import type { Metadata } from 'next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/auth';
import { ConfigProvider } from '@/components/providers/ConfigProvider';
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
            <ConfigProvider>
              <AppLayout session={session}>
                {children}
              </AppLayout>
              <Toaster position="top-right" richColors />
            </ConfigProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
