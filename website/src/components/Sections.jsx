import { useRef, useState } from 'react';
import BrandLogo from '../../../src/common/components/brand/BrandLogo';
import SyncArc from '../../../src/common/components/brand/SyncArc';
import Icon from './Icon';
import ScreenSlot from './ScreenSlot';
import { screens, site } from '../config';
import { useCountUp, useInView, useScrollVar } from '../lib/hooks';

const Stat = ({ value, suffix = '', label, active, raw }) => {
  const n = useCountUp(value || 0, active);
  return (
    <div className="stat" data-reveal>
      <b dir="ltr">{raw || `${n.toLocaleString('en-US')}${suffix}`}</b>
      <span>{label}</span>
    </div>
  );
};

export const Numbers = () => {
  const [ref, inView] = useInView(0.4);
  return (
    <section className="numbers" ref={ref} aria-label="במספרים">
      <div className="container numbers__grid">
        <Stat value={2000} suffix="+" label="דגמי מכשירי מעקב נתמכים" active={inView} />
        <Stat value={200} suffix="+" label="פרוטוקולי תקשורת" active={inView} />
        <Stat raw="24/7" label="מעקב רציף, בלי הפסקה" active={inView} />
        <Stat value={100} suffix="%" label="עברית, מימין לשמאל" active={inView} />
      </div>
    </section>
  );
};

const STEPS = [
  [
    '01',
    'מתקינים יחידה',
    'מתקין מטעמנו מגיע אליכם. כבר יש יחידות ברכבים? רוב הדגמים עובדים כמו שהם.',
  ],
  [
    '02',
    'מגדירים את הצי',
    'רכבים, נהגים, קבוצות ומשתמשים, עם הרשאות לכל תפקיד. אנחנו עוזרים בהקמה.',
  ],
  ['03', 'רואים הכל', 'מפה חיה, התראות ודוחות, כבר מהיום הראשון. במחשב ובנייד.'],
];

export const Steps = () => {
  const ref = useRef(null);
  useScrollVar(ref, { start: 0.85, end: 0.6 });
  return (
    <section id="start" className="section steps">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow" data-reveal>
            ALWAYS IN VIEW.
          </p>
          <h2 className="h-display h-display--md" data-reveal>
            שלושה צעדים.
            <br />
            <span className="accent">וכל הצי בתמונה.</span>
          </h2>
        </div>
        <ol className="steps__list" ref={ref}>
          <span className="steps__line" aria-hidden="true">
            <i />
          </span>
          {STEPS.map(([num, title, body]) => (
            <li key={num} className="step" data-reveal>
              <span className="step__num" dir="ltr">
                {num}
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export const Mobile = () => {
  const ref = useRef(null);
  useScrollVar(ref);
  return (
    <section className="section mobile" ref={ref}>
      <div className="container mobile__grid">
        <div className="mobile__text">
          <p className="eyebrow" data-reveal>
            IN YOUR POCKET
          </p>
          <h2 className="h-display h-display--md" data-reveal>
            כל הצי.
            <br />
            <span className="accent">גם בכיס.</span>
          </h2>
          <p className="lead" data-reveal>
            אותה מערכת, מותאמת לנייד. בלי חנות אפליקציות ובלי התקנה: פותחים בדפדפן ומוסיפים למסך
            הבית.
          </p>
          <ul className="checks" data-reveal>
            <li>
              <Icon name="check" size={18} />
              התראות ישירות לטלפון
            </li>
            <li>
              <Icon name="check" size={18} />
              מפה, רכבים ודוחות בממשק מגע
            </li>
            <li>
              <Icon name="check" size={18} />
              שיתוף מיקום חי בקישור, בלחיצה
            </li>
          </ul>
        </div>
        <div className="mobile__phones" aria-label="צילומי מסך מהנייד">
          <div className="phone phone--back">
            <ScreenSlot screen={screens.mobileDevice} />
          </div>
          <div className="phone phone--front">
            <ScreenSlot screen={screens.mobileMap} />
          </div>
        </div>
      </div>
    </section>
  );
};

const FAQ = [
  [
    'אילו מכשירי מעקב נתמכים?',
    'המערכת תומכת ביותר מ-2,000 דגמים של יחידות GPS, מעל יותר מ-200 פרוטוקולים. אם כבר יש לכם יחידות ברכבים, סביר שהן יעבדו כמו שהן.',
  ],
  [
    'צריך להתקין אפליקציה?',
    'לא. המערכת עובדת בדפדפן, במחשב ובנייד. בנייד אפשר להוסיף אותה למסך הבית ולהשתמש בה כמו באפליקציה.',
  ],
  [
    'אפשר לתת גישה לכמה אנשים בארגון?',
    'כן. לכל משתמש יש תפקיד והרשאות משלו, ואפשר להגביל אותו לרכבים או לקבוצות מסוימות.',
  ],
  [
    'מה קורה כשהרכב נמצא באזור בלי קליטה?',
    'רוב היחידות שומרות את הנתונים ושולחות אותם כשהקליטה חוזרת, כך שהמסלול נשאר שלם.',
  ],
  [
    'אילו התראות אפשר להגדיר?',
    'חריגת מהירות, כניסה ויציאה מגדרות, הנעה וכיבוי, עצירה ממושכת, דלק, טיפולים, תוקף מסמכים ועוד. ההתראות מגיעות למסך, לנייד ולמייל.',
  ],
];

export const Faq = () => (
  <section id="faq" className="section faq">
    <div className="container faq__grid">
      <div>
        <p className="eyebrow" data-reveal>
          FAQ
        </p>
        <h2 className="h-display h-display--md" data-reveal>
          שאלות.
          <br />
          <span className="accent">ותשובות.</span>
        </h2>
      </div>
      <div className="faq__list">
        {FAQ.map(([q, a]) => (
          <details key={q} className="qa" data-reveal>
            <summary>
              {q}
              <Icon name="plus" size={22} />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

const YEAR = new Date().getFullYear();
const SIZES = ['1–10', '11–50', '51–200', '200+'];

const whatsappHref = (phone, text) => {
  const digits = String(phone).replace(/\D/g, '');
  const number = digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
};

// Sends the demo request through the first configured channel (see src/config.js). Success is
// shown only when a channel took the request.
const sendLead = async (lead) => {
  const text = [
    'תיאום הדגמה · viper fleet',
    `שם: ${lead.name}`,
    `חברה: ${lead.company || '-'}`,
    `טלפון: ${lead.phone}`,
    `גודל צי: ${lead.size}`,
  ].join('\n');
  if (site.leadEndpoint) {
    const response = await fetch(site.leadEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, source: 'website', page: window.location.href }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return 'endpoint';
  }
  if (site.whatsapp) {
    window.open(whatsappHref(site.whatsapp, text), '_blank', 'noopener');
    return 'whatsapp';
  }
  if (site.contactEmail) {
    window.location.href = `mailto:${site.contactEmail}?subject=${encodeURIComponent(
      'תיאום הדגמה · viper fleet',
    )}&body=${encodeURIComponent(text)}`;
    return 'email';
  }
  throw new Error('not configured');
};

export const Contact = () => {
  // idle | sending | endpoint | whatsapp | email | error
  const [state, setState] = useState('idle');
  const sent = ['endpoint', 'whatsapp', 'email'].includes(state);
  const onSubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // Honeypot: people never fill the hidden field, bots usually do.
    if (data.get('website')) {
      return;
    }
    setState('sending');
    try {
      setState(
        await sendLead({
          name: data.get('name'),
          company: data.get('company'),
          phone: data.get('phone'),
          size: data.get('size'),
        }),
      );
    } catch {
      setState('error');
    }
  };

  return (
    <section id="contact" className="contact">
      <SyncArc width={520} className="contact__arc" style={{ left: -40, bottom: -150 }} />
      <div className="container contact__grid">
        <div className="contact__text">
          <p className="eyebrow eyebrow--light" data-reveal>
            one fleet. one focus.
          </p>
          <h2 className="h-display h-display--light" data-reveal>
            צי אחד.
            <br />
            <span className="accent-aqua">פוקוס אחד.</span>
          </h2>
          <p className="contact__lead" data-reveal>
            השאירו פרטים ונראה לכם את viper fleet על הצי שלכם. בלי התחייבות.
          </p>
          {site.phone && (
            <p className="contact__phone" data-reveal>
              או התקשרו: <a href={`tel:${site.phone}`}>{site.phone}</a>
            </p>
          )}
        </div>
        <form className="form" onSubmit={onSubmit} data-reveal>
          {sent ? (
            <div className="form__done" role="status">
              <span className="form__check">
                <Icon name="check" size={28} />
              </span>
              <strong>{state === 'endpoint' ? 'תודה. קיבלנו.' : 'כמעט סיימנו.'}</strong>
              <p>
                {state === 'endpoint'
                  ? 'נחזור אליכם בהקדם לתיאום ההדגמה.'
                  : state === 'whatsapp'
                    ? 'נפתח וואטסאפ עם הפרטים. שלחו את ההודעה ונחזור אליכם.'
                    : 'נפתחה הודעת מייל עם הפרטים. שלחו אותה ונחזור אליכם.'}
              </p>
            </div>
          ) : (
            <>
              <label className="field">
                <span>שם מלא</span>
                <input name="name" required autoComplete="name" />
              </label>
              <label className="field">
                <span>חברה</span>
                <input name="company" autoComplete="organization" />
              </label>
              <label className="field">
                <span>טלפון</span>
                <input name="phone" type="tel" required autoComplete="tel" dir="ltr" />
              </label>
              <fieldset className="field field--sizes">
                <legend>כמה רכבים בצי?</legend>
                <div className="sizes">
                  {SIZES.map((s, i) => (
                    <label key={s}>
                      <input type="radio" name="size" value={s} defaultChecked={i === 1} />
                      <span dir="ltr">{s}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="form__trap" aria-hidden="true">
                <span>אתר</span>
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
              {state === 'error' && (
                <p className="form__error" role="alert">
                  לא הצלחנו לשלוח את הפרטים.{' '}
                  {site.whatsapp || site.phone
                    ? 'אפשר לפנות אלינו ישירות:'
                    : 'נסו שוב בעוד כמה דקות.'}{' '}
                  {site.whatsapp && (
                    <a href={whatsappHref(site.whatsapp, 'תיאום הדגמה · viper fleet')}>וואטסאפ</a>
                  )}
                  {site.whatsapp && site.phone && ' · '}
                  {site.phone && <a href={`tel:${site.phone}`}>{site.phone}</a>}
                </p>
              )}
              <button
                type="submit"
                className="btn btn--primary btn--block"
                disabled={state === 'sending'}
              >
                {state === 'sending' ? 'שולחים…' : 'תיאום הדגמה'}
                <Icon name="arrow" size={18} />
              </button>
            </>
          )}
        </form>
      </div>
    </section>
  );
};

export const Footer = () => (
  <footer className="footer">
    <div className="container footer__grid">
      <div className="footer__brand">
        <BrandLogo variant="reverse" height={30} />
        <p>כל רכב. כל רגע. בתמונה אחת.</p>
      </div>
      <nav className="footer__links" aria-label="קישורים">
        <a href="#journey">הנסיעה</a>
        <a href="#product">המערכת</a>
        <a href="#features">יכולות</a>
        <a href="#faq">שאלות</a>
        <a href={site.appUrl}>כניסה למערכת</a>
      </nav>
    </div>
    <div className="container footer__legal" dir="ltr">
      <span>VIPER FLEET / SYNC POINT</span>
      <span>© {YEAR} VIPER FLEET</span>
    </div>
  </footer>
);
