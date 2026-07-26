const footerLinks = [
  ['How we count', '/how-we-count'],
  ['Sources', '/sources'],
  ['Methodology', '/methodology'],
  ['Data', '/data'],
  ['About', '/about'],
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <p className="footer-brand label">Common Scale</p>
          <p className="footer-note text-sm">
            One measured scale for comparing electricity-source safety. Figures are estimates
            with explicit uncertainty bands, not verdicts about any single project.
          </p>
        </div>
        <nav className="footer-nav" aria-label="Footer">
          {footerLinks.map(([label, href]) => (
            <a key={href} href={href} className="nav-link">
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
