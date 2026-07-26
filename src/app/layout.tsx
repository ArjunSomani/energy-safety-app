import './globals.css';
import { Archivo, IBM_Plex_Mono, Literata } from 'next/font/google';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const serif = Literata({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const display = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Common Scale',
  description: 'A neutral reference for comparing electricity-source safety on a shared scale.',
};

// Set the theme before first paint to avoid a flash of the wrong palette.
const themeScript = `(function(){try{var t=localStorage.getItem('cs-theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${display.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <SiteHeader />
        <div className="site-main">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
