import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SketchBake',
  description: '2D sketch → 3D mesh for game dev',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-full bg-neutral-900 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
