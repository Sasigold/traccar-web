import { translate } from '../../util/translator';
import { SYMBOL_BRACKET_BOTTOM, SYMBOL_BRACKET_TOP, SYMBOL_DOT } from './brandGeometry';

// The brand loading animation: the app icon whose two brackets sync onto the
// center point. The animation itself lives in public/styles.css (.vf-loader),
// shared with the startup loader in index.html, so both stay identical.
// Use it for any loading state that fills an area. Full-screen loading goes
// through <Loader />, which shows the instance in index.html.
// A11-08: it says what it is doing ("Loading…"), not the brand's name.
const BrandLoader = ({ size = 72, label, className }) => (
  <svg
    className={className ? `vf-loader ${className}` : 'vf-loader'}
    width={size}
    height={size}
    viewBox="0 0 100 100"
    role="progressbar"
    aria-label={label || translate('sharedLoading')}
    style={{ width: size, height: size, direction: 'ltr' }}
  >
    <rect className="vf-loader__tile" width="100" height="100" rx="22" />
    <g transform="translate(14 14) scale(.72)">
      <circle className="vf-loader__ring" cx={SYMBOL_DOT.cx} cy={SYMBOL_DOT.cy} r={SYMBOL_DOT.r} />
      <path className="vf-loader__mark vf-loader__top" d={SYMBOL_BRACKET_TOP} />
      <path className="vf-loader__mark vf-loader__bottom" d={SYMBOL_BRACKET_BOTTOM} />
      <circle
        className="vf-loader__mark vf-loader__dot"
        cx={SYMBOL_DOT.cx}
        cy={SYMBOL_DOT.cy}
        r={SYMBOL_DOT.r}
      />
    </g>
  </svg>
);

export default BrandLoader;
