import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { ChatWidget } from '@/components/ui/ChatWidget';

export const metadata: Metadata = {
  title: '3RPC · SAP Security Monitor',
  description: 'Dashboard de monitoreo de logs SAP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-surface-base text-text-primary">
        <div className="flex min-h-screen">

          {/* Sidebar — wrapped in Suspense because it uses useSearchParams() */}
          <Suspense fallback={
            <div className="fixed inset-y-0 left-0 w-64 bg-surface-base border-r border-surface-border" />
          }>
            <Sidebar />
          </Suspense>

          {/* Main content */}
          <main className="flex-1 ml-64 min-h-screen">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3 text-text-secondary">
                  <span className="w-4 h-4 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
                  Cargando…
                </div>
              </div>
            }>
              {children}
            </Suspense>
          </main>

        </div>
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
      </body>
    </html>
  );
}
