import './globals.css';

export const metadata = {
  title: 'Common Scale',
  description: 'A neutral reference for comparing electricity-source safety on a shared scale.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="flex flex-wrap gap-4 border-b border-[var(--rule)] p-4 text-sm">
          <a href="/">Common Scale</a>
          <a href="/how-we-count">How we count</a>
          <a href="/sources">Sources</a>
          <a href="/build">Build</a>
          <a href="/countries">Countries</a>
          <a href="/data">Data</a>
          <a href="/methodology">Methodology</a>
          <a href="/about">About</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
