import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Canon — stop agents acting on expired facts',
  description:
    'Agents act confidently on facts that stopped being true. Canon checks a proposed action against when each fact was true, and blocks it with receipts when a premise has expired.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
