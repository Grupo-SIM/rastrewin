import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'SorteioPilot — entre em centenas de sorteios no automático' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
