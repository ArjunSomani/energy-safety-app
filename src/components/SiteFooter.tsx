const footerLinks = [
  ['How we count', '/how-we-count'],
  ['Sources', '/sources'],
  ['Compare', '/compare'],
  ['Value of a life', '/value'],
  ['Methodology', '/methodology'],
  ['Data', '/data'],
  ['About', '/about'],
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <nav className="footer-nav" aria-label="Footer">
          {footerLinks.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div>One measured scale for electricity-source safety — estimates with explicit uncertainty, not verdicts.</div>
      </div>
    </footer>
  );
}
