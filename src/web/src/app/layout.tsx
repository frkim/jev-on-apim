import type { Metadata } from 'next';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { AppShell } from '@/components/AppShell';
import { ThemeRegistry } from '@/components/ThemeRegistry';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jev Evaluation Studio',
  description: 'Evaluate TypeSafe AI Jev System One decisions through Azure API Management.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <InitColorSchemeScript attribute="class" modeStorageKey="jev-studio-color-mode" defaultMode="system" />
        <ThemeRegistry>
          <AppShell>{children}</AppShell>
        </ThemeRegistry>
      </body>
    </html>
  );
}
