import { brandColors } from '../../theme/tokens';

// Enlarged lower bracket of the Sync Point symbol with its point, the hero
// graphic of the brand book (pages 01 and 16). Decorative only: keep it out of
// dense content areas, never mirror it (it keeps its orientation in RTL), and
// let it bleed off the edge of a navy surface.
//
// Position it with the inline `style` prop: emotion's RTL plugin would flip
// left/right inside makeStyles.
const SyncArc = ({
  width = 320,
  color = brandColors.aqua,
  dot = brandColors.ice,
  style,
  className,
}) => (
  <svg
    width={width}
    height={(width * 620) / 600}
    viewBox="0 0 600 620"
    className={className}
    style={{ position: 'absolute', pointerEvents: 'none', direction: 'ltr', ...style }}
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill={color}
      d="M0 0 H183 V271 A87 87 0 0 0 270 358 H600 V541 H270 A270 270 0 0 1 0 271 Z"
    />
    <circle fill={dot} cx="199" cy="570" r="47" />
  </svg>
);

export default SyncArc;
