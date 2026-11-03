import { brandColors } from '../../theme/tokens';
import {
  LOGO_HEIGHT,
  LOGO_WIDTH,
  SYMBOL_DOT,
  SYMBOL_PATH,
  WORDMARK_OFFSET,
  WORDMARK_PATH,
} from './brandGeometry';

// The approved color pairings (brand book page 17). Never invent new ones.
//   primary  - navy symbol + ink wordmark, on paper / ice / white
//   reverse  - aqua symbol + paper wordmark, on navy
//   white    - all paper, on ink or photography
//   onAqua   - navy symbol + navy wordmark, on aqua
//   ink      - all ink, monochrome on light surfaces
export const logoVariants = {
  primary: { mark: brandColors.navy, text: brandColors.ink },
  reverse: { mark: brandColors.aqua, text: brandColors.paper },
  white: { mark: brandColors.paper, text: brandColors.paper },
  onAqua: { mark: brandColors.navy, text: brandColors.navy },
  ink: { mark: brandColors.ink, text: brandColors.ink },
};

// The Sync Point symbol. Geometry is fixed: never stretch, rotate, mirror or
// move the center point. Minimum size 16px. The symbol does not flip in RTL.
export const BrandSymbol = ({ size = 32, color = brandColors.navy, className, title }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    className={className}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : 'true'}
    focusable="false"
    style={{ direction: 'ltr', flexShrink: 0 }}
  >
    <path fill={color} d={SYMBOL_PATH} />
    <circle fill={color} cx={SYMBOL_DOT.cx} cy={SYMBOL_DOT.cy} r={SYMBOL_DOT.r} />
  </svg>
);

// App icon: aqua symbol on a midnight navy square (brand book page 09).
export const BrandAppIcon = ({ size = 32, radius = 0.22, className, title }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    className={className}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : 'true'}
    focusable="false"
    style={{ direction: 'ltr', flexShrink: 0 }}
  >
    <rect width="100" height="100" rx={100 * radius} fill={brandColors.navy} />
    <g transform="translate(14 14) scale(.72)">
      <path fill={brandColors.aqua} d={SYMBOL_PATH} />
      <circle fill={brandColors.aqua} cx={SYMBOL_DOT.cx} cy={SYMBOL_DOT.cy} r={SYMBOL_DOT.r} />
    </g>
  </svg>
);

// Horizontal lockup "symbol + viper fleet". Minimum width 160px; the clear
// space around it equals the diameter of the center point. Never set the
// wordmark in live text or another font, and keep it lowercase.
const BrandLogo = ({ variant = 'primary', height = 28, className, title = 'viper fleet' }) => {
  const colors = logoVariants[variant] || logoVariants.primary;
  const width = (height * LOGO_WIDTH) / LOGO_HEIGHT;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}`}
      className={className}
      role="img"
      aria-label={title}
      focusable="false"
      style={{ direction: 'ltr', flexShrink: 0 }}
    >
      <path fill={colors.mark} d={SYMBOL_PATH} />
      <circle fill={colors.mark} cx={SYMBOL_DOT.cx} cy={SYMBOL_DOT.cy} r={SYMBOL_DOT.r} />
      <path
        fill={colors.text}
        transform={`translate(${WORDMARK_OFFSET.x} ${WORDMARK_OFFSET.y})`}
        d={WORDMARK_PATH}
      />
    </svg>
  );
};

export default BrandLogo;
