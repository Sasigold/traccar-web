import { useEffect, useState } from 'react';
import BrandLogo from '../../../src/common/components/brand/BrandLogo';
import { site } from '../config';

const LINKS = [
  ['#journey', 'הנסיעה'],
  ['#product', 'המערכת'],
  ['#features', 'יכולות'],
  ['#start', 'איך מתחילים'],
  ['#faq', 'שאלות'],
];

const Nav = () => {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
  }, [open]);

  return (
    <header className={`nav${solid ? ' is-solid' : ''}${open ? ' is-open' : ''}`}>
      <div className="nav__bar">
        <a href="#top" className="nav__logo" aria-label="viper fleet, לראש העמוד">
          <BrandLogo variant="reverse" height={26} />
        </a>
        <nav className="nav__links" aria-label="ניווט ראשי">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
        <div className="nav__actions">
          <a className="nav__login" href={site.appUrl}>
            כניסה למערכת
          </a>
          <a className="btn btn--ghost btn--sm" href="#contact" onClick={() => setOpen(false)}>
            תיאום הדגמה
          </a>
          <button
            type="button"
            className="nav__burger"
            aria-label={open ? 'סגירת התפריט' : 'פתיחת התפריט'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <i />
            <i />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Nav;
