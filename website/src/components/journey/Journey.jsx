import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BrandAppIcon } from '../../../../src/common/components/brand/BrandLogo';
import Icon from '../Icon';
import Vehicle from './Vehicle';
import { clamp, reducedMotion } from '../../lib/hooks';
import {
  CHAPTERS,
  DRIVER,
  EVENTS,
  ROWS_AT,
  SUMMARY,
  TRIP_KM,
  TRIP_MINUTES,
  ZONES,
  chapterAt,
  clockAt,
  distanceAt,
  fuelAt,
  laneAt,
  speedAt,
} from './model';

const PINNED = new Set(['fence', 'speed', 'warning', 'gas', 'build']);
const CHAPTER_SHORT = ['יציאה', 'בתנועה', 'התראות', 'תחזוקה', 'הגעה'];
const LANE_Y = [0.31, 0.69]; // own lane (westbound keeps right = top), passing lane
const fmtKm = (km) => km.toFixed(1);
const fmtDuration = (min) =>
  `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;

const measure = (road) => {
  const W = road.clientWidth;
  const H = road.clientHeight;
  const mobile = W < 760;
  const carW = Math.round(H * 0.74);
  const m = Math.max(W * (mobile ? 0.2 : 0.14), carW * 0.95);
  const Wworld = Math.max(W * (mobile ? 4.2 : 3.1), 2400);
  return { W, H, carW, carH: (carW * 124) / 240, m, Wworld, mobile };
};

const Summary = ({ ended, className }) => (
  <div className={`summary ${className}${ended ? ' is-in' : ''}`} aria-hidden={!ended}>
    <p className="summary__title">
      <Icon name="chart" size={18} />
      דוח נסיעה
      <span className="summary__tag" dir="ltr">
        {clockAt(0)} → {clockAt(72.2)}
      </span>
    </p>
    <dl className="summary__grid">
      <div>
        <dt>מרחק</dt>
        <dd>
          <b dir="ltr">{fmtKm(SUMMARY.km)}</b> ק״מ
        </dd>
      </div>
      <div>
        <dt>משך</dt>
        <dd>
          <b dir="ltr">{fmtDuration(SUMMARY.minutes)}</b> שעות
        </dd>
      </div>
      <div>
        <dt>מהירות מרבית</dt>
        <dd>
          <b dir="ltr">{SUMMARY.max}</b> קמ״ש
        </dd>
      </div>
      <div>
        <dt>אירועים</dt>
        <dd>
          <b dir="ltr">{SUMMARY.events}</b>
        </dd>
      </div>
    </dl>
  </div>
);

const Journey = () => {
  const trackRef = useRef(null);
  const roadRef = useRef(null);
  const nodesRef = useRef({}); // imperatively updated nodes
  const set = (key) => (el) => {
    nodesRef.current[key] = el;
  };

  const [layout, setLayout] = useState(null);
  const [chapter, setChapter] = useState(0);
  const [fired, setFired] = useState(0);
  const [rows, setRows] = useState(0);
  const [ended, setEnded] = useState(false);

  useLayoutEffect(() => {
    const road = roadRef.current;
    const update = () => setLayout(measure(road));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(road);
    return () => ro.disconnect();
  }, []);

  // World geometry derived from the layout.
  const geo = useMemo(() => {
    if (!layout) return null;
    const { Wworld, m, H, carW } = layout;
    const xAt = (t) => Wworld - m - (distanceAt(t) / TRIP_KM) * (Wworld - 2 * m);
    const pts = [];
    for (let t = 0; t <= TRIP_MINUTES; t += 0.25) {
      const lane = laneAt(t);
      pts.push(
        `${xAt(t).toFixed(1)},${(H * (LANE_Y[0] + (LANE_Y[1] - LANE_Y[0]) * lane)).toFixed(1)}`,
      );
    }
    const zones = ZONES.map((z) => {
      if (z.kind === 'station') return { ...z, x: xAt(z.at) };
      const start = z.from < 0 ? Wworld - m + carW * 0.9 : xAt(z.from);
      const end = z.to > TRIP_MINUTES ? m - carW * 0.9 : xAt(z.to);
      return { ...z, x: Math.min(start, end), w: Math.abs(start - end) };
    });
    const ticks = [];
    for (let km = 10; km < TRIP_KM; km += 10) {
      ticks.push({ km, x: Wworld - m - (km / TRIP_KM) * (Wworld - 2 * m) });
    }
    const pins = EVENTS.map((e, i) => ({ ...e, i, x: xAt(e.t) })).filter((e) => PINNED.has(e.icon));
    return { route: `M${pts.join(' L')}`, zones, ticks, pins };
  }, [layout]);

  // The scroll-driven render loop.
  useEffect(() => {
    if (!layout) return undefined;
    const track = trackRef.current;
    const still = reducedMotion();
    let cur = -1;
    let raf = 0;
    let last = performance.now();
    let state = { chapter: -1, fired: -1, rows: -1, ended: null };
    let visible = true;

    const targetProgress = () => {
      const r = track.getBoundingClientRect();
      return clamp(-r.top / (r.height - window.innerHeight));
    };

    const render = (p) => {
      const { W, H, carW, carH, m, Wworld } = layout;
      const t = p * TRIP_MINUTES;
      const d = distanceAt(t) / TRIP_KM;
      const v = speedAt(t);
      const lane = laneAt(t);
      const slope = (laneAt(t + 0.2) - laneAt(t - 0.2)) / 0.4;
      const dv = (speedAt(t + 0.3) - speedAt(t - 0.3)) / 0.6;
      const fuel = fuelAt(t);
      const x = W - m - d * (W - 2 * m);
      const y = H * (LANE_Y[0] + (LANE_Y[1] - LANE_Y[0]) * lane);
      const nodes = nodesRef.current;

      nodes.world.style.transform = `translate3d(${((W - Wworld) * (1 - d)).toFixed(2)}px,0,0)`;
      nodes.car.style.transform = `translate3d(${(x - carW / 2).toFixed(2)}px,${(y - carH / 2).toFixed(2)}px,0) rotate(${(-slope * 7).toFixed(2)}deg)`;
      nodes.trail.style.strokeDashoffset = (1000 * (1 - d)).toFixed(2);
      nodes.lines.style.opacity = clamp((v - 40) / 50).toFixed(3);
      nodes.lines.style.transform = `scaleX(${(0.4 + clamp(v / 110) * 0.8).toFixed(3)})`;
      nodes.brake.classList.toggle('is-on', dv < -9 || (v < 2 && t > 1 && t < 72.2));

      const hudW = nodes.hud.offsetWidth;
      const hx = clamp(x, hudW / 2 + 12, W - hudW / 2 - 12);
      nodes.hud.style.transform = `translate3d(${(hx - hudW / 2).toFixed(2)}px,0,0)`;
      nodes.stem.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      nodes.stem.style.height = `${(y - carH / 2 + 18).toFixed(1)}px`;

      const on = t >= 1 && t < 72.2;
      nodes.status.textContent = on ? (v > 2 ? 'בנסיעה' : 'מנוע פועל') : 'חונה';
      nodes.statusDot.dataset.on = on ? '1' : '0';
      nodes.sats.textContent = String(on ? 11 + Math.round(Math.abs(Math.sin(t * 0.7)) * 4) : 0);
      nodes.speed.textContent = String(Math.round(v));
      nodes.speedBar.style.transform = `scaleX(${clamp(v / 120).toFixed(3)})`;
      nodes.speedRow.dataset.warn = v > 92 ? '1' : '0';
      nodes.fuel.textContent = String(Math.round(fuel));
      nodes.fuelBar.style.transform = `scaleX(${clamp(fuel / 100).toFixed(3)})`;
      nodes.fuelRow.dataset.warn = fuel < 25 ? '1' : '0';
      nodes.lat.textContent = (31.9632 - d * 0.3418).toFixed(4);
      nodes.lng.textContent = (34.8964 - d * 0.1127).toFixed(4);

      nodes.fill.style.transform = `scaleX(${p.toFixed(4)})`;
      nodes.clock.textContent = clockAt(t);
      nodes.km.textContent = fmtKm(distanceAt(t));
      if (nodes.mSpeed) nodes.mSpeed.textContent = String(Math.round(v));

      const next = {
        chapter: chapterAt(t),
        fired: EVENTS.filter((e) => e.t <= t).length,
        rows: ROWS_AT.filter((r) => r <= t).length,
        ended: t >= 72.4,
      };
      if (next.chapter !== state.chapter) setChapter(next.chapter);
      if (next.fired !== state.fired) setFired(next.fired);
      if (next.rows !== state.rows) setRows(next.rows);
      if (next.ended !== state.ended) setEnded(next.ended);
      state = next;
    };

    const frame = (now) => {
      raf = 0;
      const target = targetProgress();
      const dt = Math.min(64, now - last);
      last = now;
      let p;
      if (cur < 0 || still) p = target;
      else {
        const k = 1 - (1 - 0.1) ** (dt / 16.67);
        p = cur + (target - cur) * k;
        if (Math.abs(target - p) < 0.00004) p = target;
      }
      if (p !== cur) {
        cur = p;
        render(p);
      }
      if (visible && (p !== target || !still)) raf = requestAnimationFrame(frame);
    };

    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
    });
    io.observe(track);
    window.addEventListener('scroll', kick, { passive: true });
    kick();
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', kick);
      cancelAnimationFrame(raf);
    };
  }, [layout]);

  const feed = EVENTS.slice(0, fired).reverse();
  const latest = feed[0];
  const c = CHAPTERS[chapter];

  return (
    <section id="journey" className="journey" aria-label="נסיעה אחת, מקצה לקצה">
      <div className="container journey__intro">
        <p className="eyebrow" data-reveal>
          THE DRIVE / 05 CHAPTERS
        </p>
        <h2 className="h-display h-display--md" data-reveal>
          נסיעה אחת.
          <br />
          <span className="accent">כל מה שהמערכת רואה.</span>
        </h2>
        <p className="lead" data-reveal>
          גללו וצאו לדרך עם רכב אחד, מהמחסן ועד הלקוח. כל נתון שמופיע בדרך הוא נתון שתראו במערכת.
        </p>
        <div className="scroll-cue" data-reveal aria-hidden="true">
          <Icon name="south" size={18} />
          <span>גללו כדי לנסוע</span>
        </div>
      </div>

      <div className="journey__track" ref={trackRef}>
        <div className="journey__stage">
          <div className="container journey__top">
            <div className="chapter" key={chapter} aria-live="polite">
              <p className="chapter__meta" dir="ltr">
                <span>0{chapter + 1}</span>
                <span className="chapter__of">/ 05</span>
                <span className="chapter__en">{c.en}</span>
              </p>
              <h3 className="chapter__title">
                {c.title[0]}
                <br />
                <span>{c.title[1]}</span>
              </h3>
              <p className="chapter__body">{c.body}</p>
            </div>

            <div className={`side${ended ? ' is-ended' : ''}`}>
              <aside className="feed" aria-label="התראות">
                <header className="feed__head">
                  <span className="feed__title">
                    <Icon name="bell" size={18} />
                    התראות
                  </span>
                  <span className="live" dir="ltr">
                    <i />
                    LIVE
                  </span>
                </header>
                <ol className="feed__list">
                  {feed.length === 0 && (
                    <li className="feed__empty">אין אירועים עדיין. הרכב חונה.</li>
                  )}
                  {feed.slice(0, 4).map((e) => (
                    <li key={e.t} className={`alert alert--${e.tone}`}>
                      <span className="alert__icon">
                        <Icon name={e.icon} size={18} />
                      </span>
                      <span className="alert__text">
                        <strong>{e.title}</strong>
                        <span>{e.meta}</span>
                      </span>
                      <time className="alert__time" dir="ltr">
                        {clockAt(e.t)}
                      </time>
                    </li>
                  ))}
                </ol>
              </aside>
              <Summary ended={ended} className="summary--side" />
            </div>
          </div>

          <div
            className={`road${ended ? ' is-ended' : ''}`}
            ref={roadRef}
            style={layout ? { '--car-w': `${layout.carW}px` } : undefined}
          >
            <div
              className="world"
              ref={set('world')}
              dir="ltr"
              style={layout ? { width: layout.Wworld } : undefined}
            >
              {layout && geo && (
                <>
                  <svg
                    className="world__svg"
                    width={layout.Wworld}
                    height={layout.H}
                    viewBox={`0 0 ${layout.Wworld} ${layout.H}`}
                    aria-hidden="true"
                  >
                    <line
                      className="road__edge"
                      x1="0"
                      x2={layout.Wworld}
                      y1={layout.H * 0.1}
                      y2={layout.H * 0.1}
                    />
                    <line
                      className="road__edge"
                      x1="0"
                      x2={layout.Wworld}
                      y1={layout.H * 0.9}
                      y2={layout.H * 0.9}
                    />
                    <line
                      className="road__lane"
                      x1="0"
                      x2={layout.Wworld}
                      y1={layout.H / 2}
                      y2={layout.H / 2}
                    />
                    {geo.zones
                      .filter((z) => z.kind === 'fence')
                      .map((z) => (
                        <rect
                          key={z.id}
                          className="road__fence"
                          x={z.x}
                          y={layout.H * 0.14}
                          width={z.w}
                          height={layout.H * 0.72}
                          rx="12"
                        />
                      ))}
                    {geo.zones
                      .filter((z) => z.kind === 'limit')
                      .map((z) => (
                        <rect
                          key={z.id}
                          className="road__limit"
                          x={z.x}
                          y={layout.H * 0.1 - 2}
                          width={z.w}
                          height="4"
                          rx="2"
                        />
                      ))}
                    <path className="road__plan" d={geo.route} />
                    <path
                      className="road__trail"
                      d={geo.route}
                      pathLength="1000"
                      ref={set('trail')}
                    />
                  </svg>

                  {geo.zones.map((z) =>
                    z.kind === 'fence' ? (
                      <span key={z.id} className="zone-label" style={{ left: z.x + 14 }}>
                        <span className="zone-label__tag">{z.tag}</span>
                        <span dir="rtl">{z.label}</span>
                      </span>
                    ) : z.kind === 'limit' ? (
                      <span
                        key={z.id}
                        className="limit-sign"
                        style={{ left: z.x + z.w }}
                        title={z.label}
                      >
                        {z.tag}
                      </span>
                    ) : (
                      <span key={z.id} className="station" style={{ left: z.x }}>
                        <Icon name="gas" size={18} />
                      </span>
                    ),
                  )}

                  {geo.ticks.map((tk) => (
                    <span key={tk.km} className="km-tick" style={{ left: tk.x }}>
                      KM {tk.km}
                    </span>
                  ))}

                  {geo.pins.map((e) => (
                    <span
                      key={e.i}
                      className={`pin pin--${e.tone}${e.i < fired ? ' is-on' : ''}`}
                      style={{ left: e.x }}
                    >
                      <span className="pin__dot">
                        <Icon name={e.icon} size={14} />
                      </span>
                      <span className="pin__label" dir="rtl">
                        <time dir="ltr">{clockAt(e.t)}</time> {e.title}
                      </span>
                    </span>
                  ))}
                </>
              )}
            </div>

            <div className="car" ref={set('car')}>
              <span className="car__lines" ref={set('lines')} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <Vehicle brakeRef={set('brake')} />
            </div>

            <p className="illustrative" dir="ltr">
              ILLUSTRATIVE UI / FICTIONAL DATA
            </p>
            <span className="hud-stem" ref={set('stem')} aria-hidden="true" />
            <div className="hud" ref={set('hud')}>
              <header className="hud__head">
                <BrandAppIcon size={28} />
                <span className="hud__name">
                  <strong>טנדר 12</strong>
                  <span dir="ltr">68-412-73</span>
                </span>
                <span className="hud__status">
                  <i ref={set('statusDot')} data-on="0" />
                  <span ref={set('status')}>חונה</span>
                </span>
              </header>
              <div className={`hud__band${rows > 0 ? ' is-in' : ''}`}>
                <div className="hud__grid">
                  <div className={`cell cell--gps${rows > 0 ? ' is-in' : ''}`}>
                    <span className="cell__k">
                      <Icon name="satellite" size={15} />
                      GPS
                    </span>
                    <span className="cell__v" dir="ltr">
                      <b ref={set('sats')}>0</b> SAT
                    </span>
                  </div>
                  <div
                    className={`cell${rows > 1 ? ' is-in' : ''}`}
                    ref={set('speedRow')}
                    data-warn="0"
                  >
                    <span className="cell__k">
                      <Icon name="speed" size={15} />
                      מהירות
                    </span>
                    <span className="cell__v">
                      <b ref={set('speed')}>0</b> קמ״ש
                    </span>
                    <span className="hud__bar">
                      <i ref={set('speedBar')} />
                    </span>
                  </div>
                  <div
                    className={`cell${rows > 2 ? ' is-in' : ''}`}
                    ref={set('fuelRow')}
                    data-warn="0"
                  >
                    <span className="cell__k">
                      <Icon name="gas" size={15} />
                      דלק
                    </span>
                    <span className="cell__v">
                      <b ref={set('fuel')}>0</b>%
                    </span>
                    <span className="hud__bar">
                      <i ref={set('fuelBar')} />
                    </span>
                  </div>
                </div>
              </div>
              <div className={`hud__band${rows > 3 ? ' is-in' : ''}`}>
                <div className="hud__grid hud__grid--2">
                  <div className={`cell cell--driver${rows > 3 ? ' is-in' : ''}`}>
                    <span className="cell__k">
                      <Icon name="badge" size={15} />
                      נהג
                    </span>
                    <span className="cell__v">{DRIVER}</span>
                  </div>
                  <div className={`cell cell--loc${rows > 4 ? ' is-in' : ''}`}>
                    <span className="cell__k">
                      <Icon name="pin" size={15} />
                      מיקום
                    </span>
                    <span className="cell__v" dir="ltr">
                      <span ref={set('lat')}>31.9632</span>, <span ref={set('lng')}>34.8964</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="container journey__bottom">
            <div className="bottom-slot">
              <div className={`toast${latest ? ` alert--${latest.tone}` : ''}`} key={fired}>
                {latest ? (
                  <>
                    <span className="alert__icon">
                      <Icon name={latest.icon} size={18} />
                    </span>
                    <span className="alert__text">
                      <strong>{latest.title}</strong>
                      <span>{latest.meta}</span>
                    </span>
                    <time className="alert__time" dir="ltr">
                      {clockAt(latest.t)}
                    </time>
                  </>
                ) : (
                  <span className="feed__empty">הרכב חונה במחסן. גללו כדי לצאת.</span>
                )}
              </div>

              <Summary ended={ended} className="summary--bottom" />
            </div>

            <div className="timeline">
              <div className="timeline__read">
                <span>
                  <small>שעה</small>
                  <b dir="ltr" ref={set('clock')}>
                    07:42
                  </b>
                </span>
                <span>
                  <small>מרחק</small>
                  <b dir="ltr" ref={set('km')}>
                    0.0
                  </b>
                  <small>ק״מ</small>
                </span>
                <span className="timeline__speed">
                  <small>מהירות</small>
                  <b dir="ltr" ref={set('mSpeed')}>
                    0
                  </b>
                  <small>קמ״ש</small>
                </span>
              </div>
              <div className="timeline__track">
                <span className="timeline__fill" ref={set('fill')} />
                {CHAPTERS.map((ch, i) => (
                  <span
                    key={ch.en}
                    className={`timeline__stop${i <= chapter ? ' is-on' : ''}${i === chapter ? ' is-current' : ''}`}
                    style={{ insetInlineStart: `${(ch.from / TRIP_MINUTES) * 100}%` }}
                  >
                    <i />
                    <span>{CHAPTER_SHORT[i]}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Journey;
