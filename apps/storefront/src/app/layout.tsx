import type { Metadata } from 'next';
import './store.css';

export const metadata: Metadata = {
  title: 'ONight | Health & Beauty',
  description: 'Cosmétiques sélectionnés avec soin, livrés partout au Maroc.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
