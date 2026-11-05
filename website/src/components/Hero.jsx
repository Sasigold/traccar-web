import { useEffect, useRef, useState } from 'react';
import SyncArc from '../../../src/common/components/brand/SyncArc';
import Icon from './Icon';
import ScreenSlot from './ScreenSlot';
import { screens } from '../config';
import { useScrollVar } from '../lib/hooks';

const useClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString('en-GB', { hour12: false });
};

const Hero = () => {
  const clock = useClock();
  const frameRef = useRef(null);
  const [ready, setReady] = useState(false);
  useScrollVar(frameRef, { start: 1, end: 0.35 });
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <>
      <section id="top" className={`hero${ready ? ' is-ready' : ''}`}>
        <SyncArc
          width={860}
          className="hero__arc"
          style={{ left: 'calc(var(--arc-w) * -0.25)', top: 'calc(var(--arc-w) * -0.02)' }}
        />
        <div className="container hero__inner">
          <p className="eyebrow eyebrow--light hero__rise">SYNC POINT / FLEET INTELLIGENCE</p>
          <h1 className="h-hero">
            <span className="line">
              <span className="hero__rise">כל רכב.</span>
            </span>
            <span className="line">
              <span className="hero__rise accent-aqua">כל רגע.</span>
            </span>
          </h1>
          <p className="hero__lead hero__rise">
            <strong>בתמונה אחת.</strong> viper fleet מחברת את כל הצי למסך אחד: מיקום חי, התראות,
            דוחות, תחזוקה ומסמכים. בעברית, בזמן אמת, מכל מקום.
          </p>
          <div className="hero__ctas hero__rise">
            <a className="btn btn--primary" href="#contact">
              תיאום הדגמה
              <Icon name="arrow" size={18} />
            </a>
            <a className="btn btn--text-light" href="#journey">
              צאו לנסיעה
              <Icon name="south" size={18} />
            </a>
          </div>
          <ul className="hero__meta hero__rise">
            <li dir="ltr">
              <i className="dot-live" />
              <span className="tabular">SYNCED / {clock}</span>
            </li>
            <li>מעקב 24/7</li>
            <li>2,000+ דגמי מכשירים</li>
            <li>עברית מלאה</li>
          </ul>
        </div>
      </section>

      <div className="hero-screen">
        <div className="container">
          <div className="device" ref={frameRef}>
            <div className="device__bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <span dir="ltr">viper fleet</span>
            </div>
            <ScreenSlot screen={screens.hero} priority />
          </div>
        </div>
      </div>
    </>
  );
};

export default Hero;
