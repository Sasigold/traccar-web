import Icon from './Icon';
import { useInView } from '../lib/hooks';

const MapViz = () => (
  <div className="viz viz--map" aria-hidden="true">
    <svg className="viz-map__roads" viewBox="0 0 600 340" preserveAspectRatio="none">
      {[50, 120, 190, 260].map((y) => (
        <line key={y} x1="0" x2="600" y1={y} y2={y + 14} />
      ))}
      {[60, 170, 280, 390, 500].map((x) => (
        <line key={x} x1={x} x2={x - 26} y1="0" y2="340" />
      ))}
      <path
        className="viz-map__route"
        d="M560 300 L470 286 L478 196 L360 180 L352 112 L180 92 L160 30"
      />
    </svg>
    <span className="marker marker--a" />
    <span className="marker marker--b" />
    <span className="marker marker--c" />
    <span className="marker marker--d marker--off" />
    <span className="viz-map__chip" dir="ltr">
      <i className="dot-live" /> 248 ONLINE
    </span>
  </div>
);

const ALERTS = [
  ['speed', 'warn', 'חריגת מהירות', 'טנדר 12 · 104 קמ״ש'],
  ['fence', 'ok', 'כניסה לגדר', 'משאית 4 · מרכז הפצה'],
  ['key', 'info', 'הנעה מחוץ לשעות', 'רכב 31 · 23:14'],
  ['gas', 'warn', 'ירידה חריגה בדלק', 'משאית 9 · 38 ליטר'],
];

const AlertsViz = () => (
  <div className="viz viz--alerts" aria-hidden="true">
    {ALERTS.map(([icon, tone, title, meta], i) => (
      <div key={title} className={`alert alert--${tone} viz-alert`} style={{ '--i': i }}>
        <span className="alert__icon">
          <Icon name={icon} size={18} />
        </span>
        <span className="alert__text">
          <strong>{title}</strong>
          <span>{meta}</span>
        </span>
        <span className="alert__time">עכשיו</span>
      </div>
    ))}
  </div>
);

const ReplayViz = () => (
  <div className="viz viz--replay" aria-hidden="true">
    <svg viewBox="0 0 300 120">
      <path
        className="replay__base"
        d="M290 96 C240 96 230 30 180 34 S110 100 70 80 S30 24 10 26"
      />
      <path
        className="replay__line"
        pathLength="100"
        d="M290 96 C240 96 230 30 180 34 S110 100 70 80 S30 24 10 26"
      />
      <circle className="replay__stop" cx="180" cy="34" r="5" />
      <circle className="replay__stop" cx="70" cy="80" r="5" />
    </svg>
    <div className="replay__bar" dir="ltr">
      <span className="replay__play" />
      <span className="replay__track">
        <i />
      </span>
      <span className="tabular">x8</span>
    </div>
  </div>
);

const ReportsViz = () => (
  <div className="viz viz--bars" aria-hidden="true">
    {[42, 68, 54, 88, 61, 74, 36].map((h, i) => (
      <span key={i} style={{ '--h': `${h}%`, '--i': i }} />
    ))}
  </div>
);

const FenceViz = () => (
  <div className="viz viz--fence" aria-hidden="true">
    <span className="fence__zone" />
    <span className="fence__car" />
    <span className="fence__tag">כניסה לגדר</span>
  </div>
);

const SMALL = [
  ['badge', 'נהגים וזיהוי', 'שיוך נהג לרכב, זיהוי בכרטיס ודוחות לכל נהג.'],
  ['build', 'תחזוקה', 'טיפולים לפי קילומטרים או זמן, עם תזכורת לפני המועד.'],
  ['doc', 'מסמכים ותוקף', 'רישיון, ביטוח וטסט לכל רכב ונהג, עם התראה לפני שפג התוקף.'],
  ['send', 'פקודות מרחוק', 'שליחת פקודות ליחידה: השבתת מנוע, נעילה ובקשת מיקום.'],
];

const LIST = [
  ['share', 'שיתוף מיקום בקישור'],
  ['shield', 'משתמשים, תפקידים והרשאות'],
  ['phone', 'עובד בנייד, בלי התקנה'],
  ['devices', 'יותר מ-2,000 דגמי מכשירים'],
  ['chart', 'ייצוא לאקסל ודוחות מתוזמנים'],
  ['thermo', 'חיישנים: טמפרטורה, דלתות ועוד'],
];

const Features = () => {
  const [ref, inView] = useInView(0.05);
  return (
    <section id="features" className={`section features${inView ? ' is-live' : ''}`} ref={ref}>
      <div className="container">
        <div className="section-head section-head--split">
          <div>
            <p className="eyebrow" data-reveal>
              POSITION / CONNECTION / MOVEMENT
            </p>
            <h2 className="h-display h-display--md" data-reveal>
              כל מה שצי צריך.
              <br />
              <span className="accent">במקום אחד.</span>
            </h2>
          </div>
          <p className="lead" data-reveal>
            מהמיקום של רכב בודד ועד התמונה של כל הצי. כלים שנבנו לעבודה יומיומית, ונראים כמו שצריך.
          </p>
        </div>

        <div className="bento">
          <article className="tile tile--map" data-reveal>
            <header>
              <h3>מפה חיה</h3>
              <p>כל הרכבים, במקום אחד, מתעדכנים בזמן אמת.</p>
            </header>
            <MapViz />
          </article>
          <article className="tile tile--alerts" data-reveal>
            <header>
              <h3>התראות חכמות</h3>
              <p>אתם מגדירים מה חשוב. המערכת מתריעה ברגע שזה קורה.</p>
            </header>
            <AlertsViz />
          </article>
          <article className="tile" data-reveal>
            <header>
              <h3>שחזור מסלול</h3>
              <p>כל נסיעה, עצירה ואירוע, בציר זמן אחד.</p>
            </header>
            <ReplayViz />
          </article>
          <article className="tile" data-reveal>
            <header>
              <h3>דוחות</h3>
              <p>נסיעות, עצירות, סיכומים וגרפים.</p>
            </header>
            <ReportsViz />
          </article>
          <article className="tile" data-reveal>
            <header>
              <h3>גדרות וירטואליות</h3>
              <p>אזורים על המפה, עם התראה על כל כניסה ויציאה.</p>
            </header>
            <FenceViz />
          </article>
          {SMALL.map(([icon, title, body]) => (
            <article key={title} className="tile tile--small" data-reveal>
              <span className="tile__icon">
                <Icon name={icon} size={22} />
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
          <ul className="tile tile--list" data-reveal>
            {LIST.map(([icon, label]) => (
              <li key={label}>
                <Icon name={icon} size={20} />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default Features;
