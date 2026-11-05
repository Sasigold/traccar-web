import { useEffect, useState } from 'react';
import Icon from './Icon';
import ScreenSlot from './ScreenSlot';
import { screens } from '../config';
import { reducedMotion, useInView } from '../lib/hooks';

const TABS = [
  {
    id: 'map',
    icon: 'pin',
    title: 'מפה חיה',
    body: 'כל הרכבים על מפה אחת, עם סטטוס, מהירות וכיוון. מסננים לפי קבוצה, נהג או מצב, ונכנסים לכל רכב בלחיצה.',
  },
  {
    id: 'replay',
    icon: 'history',
    title: 'היסטוריה ושחזור',
    body: 'בוחרים רכב ותאריך ומריצים את המסלול מחדש, עם עצירות, מהירויות ואירועים לאורך הדרך.',
  },
  {
    id: 'alerts',
    icon: 'bell',
    title: 'התראות',
    body: 'חריגת מהירות, יציאה מגדר, הנעה לא מורשית ודלק נמוך. ההתראות מגיעות בזמן אמת, למסך, לנייד ולמייל.',
  },
  {
    id: 'reports',
    icon: 'chart',
    title: 'דוחות',
    body: 'נסיעות, עצירות, סיכומים, גרפים ואירועים. מייצאים לאקסל או מתזמנים שליחה אוטומטית.',
  },
  {
    id: 'fleet',
    icon: 'doc',
    title: 'ניהול צי',
    body: 'רכבים, נהגים, קבוצות, טיפולים ומסמכים עם תוקף. הרשאות לפי תפקיד לכל משתמש.',
  },
];

const DURATION = 7000;

const Showcase = () => {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [ref, inView] = useInView(0.35);
  const running = auto && inView && !reducedMotion();

  useEffect(() => {
    if (!running) return undefined;
    const id = setTimeout(() => setActive((a) => (a + 1) % TABS.length), DURATION);
    return () => clearTimeout(id);
  }, [running, active]);

  return (
    <section id="product" className="section showcase" ref={ref}>
      <div className="container">
        <div className="section-head">
          <p className="eyebrow" data-reveal>
            ONE FLEET. ONE FOCUS.
          </p>
          <h2 className="h-display h-display--md" data-reveal>
            המערכת.
            <br />
            <span className="accent">מכל זווית.</span>
          </h2>
        </div>

        <div className="showcase__grid">
          <div className="tabs" role="tablist" aria-label="מסכי המערכת" data-reveal>
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={i === active}
                aria-controls="showcase-panel"
                className={`tab${i === active ? ' is-active' : ''}`}
                onClick={() => {
                  setActive(i);
                  setAuto(false);
                }}
              >
                <span className="tab__icon">
                  <Icon name={tab.icon} size={20} />
                </span>
                <span className="tab__text">
                  <strong>{tab.title}</strong>
                  <span className="tab__body">{tab.body}</span>
                </span>
                {i === active && running && (
                  <span className="tab__progress" style={{ animationDuration: `${DURATION}ms` }} />
                )}
              </button>
            ))}
          </div>

          <div
            className="showcase__screen"
            id="showcase-panel"
            role="tabpanel"
            aria-labelledby={`tab-${TABS[active].id}`}
            data-reveal
          >
            <div className="device device--flat">
              <div className="device__bar" aria-hidden="true">
                <i />
                <i />
                <i />
                <span>{TABS[active].title}</span>
              </div>
              <div className="showcase__stack">
                {TABS.map((tab, i) => (
                  <div
                    key={tab.id}
                    className={`showcase__layer${i === active ? ' is-active' : ''}`}
                  >
                    <ScreenSlot screen={screens[tab.id]} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Showcase;
