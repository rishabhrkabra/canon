import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AsOf — a temporal memory linter for AI agents',
  description:
    'Agents act confidently on facts that used to be true. AsOf is the linter you bolt onto agent memory: a deterministic engine owns truth state, the model only nominates candidates.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
