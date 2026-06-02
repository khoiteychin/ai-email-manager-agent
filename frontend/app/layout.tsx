import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'AI Email Manager — Smart Email Assistant',
  description:
    'AI-powered email management with intelligent categorization, summarization, and smart replies. Connect Gmail and manage your inbox effortlessly.',
  keywords: ['email', 'AI', 'Gmail', 'email manager', 'productivity'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={inter.className} style={{ background: '#050914' }}>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#0E1629',
                color: '#e2e8f0',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: '12px',
              },
            }}
          />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
