import './globals.css';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

// Body + UI: Geist (clean modern sans, legible at small sizes).
const sans = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });

// Data/tabular figures: Geist Mono.
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

// Display serif for headings only — editorial, energy/climate-storytelling feel.
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['opsz', 'SOFT', 'WONK'],
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL('https://levelmodel.vercel.app'),
  title: 'Level',
  description: 'A neutral reference for comparing electricity-source safety on a shared scale.',
  openGraph: {
    title: 'Level — the safety of electricity, on one scale',
    description:
      'Compare electricity sources by deaths per terawatt-hour — counted vs modeled, uncertainty shown, and priced against carbon and cost.',
    siteName: 'Level',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Level — the safety of electricity, on one scale',
    description:
      'Compare electricity sources by deaths per terawatt-hour, with the uncertainty shown and priced against carbon and cost.',
  },
};

// Set the theme before first paint to avoid a flash of the wrong palette.
const themeScript = `(function(){try{var t=localStorage.getItem('cs-theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <SiteHeader />
        <div className="site-main" id="content" tabIndex={-1}>
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
