import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { mapIconKey, mapIcons } from '../../../map/core/preloadImages';
import { brandTile } from '../../theme/surfaces';

// Vehicle tile in the app-icon style: midnight navy square with the category
// glyph in aqua. Offline / unknown devices keep the tile and dim the glyph;
// status itself is shown next to the tile, not by recoloring it.
const useStyles = makeStyles()((theme, { size, radius }) => ({
  tile: {
    ...brandTile(),
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: radius ?? theme.tokens.radius.md,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border:
      theme.palette.mode === 'dark' ? `1px solid ${theme.palette.surface.borderStrong}` : 'none',
  },
  idle: {
    color: alpha(theme.palette.brand.ice, 0.5),
  },
  glyph: {
    width: '56%',
    height: '56%',
    backgroundColor: 'currentColor',
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
  },
}));

const DeviceTile = ({ category, status, size = 36, radius, className }) => {
  const { classes, cx } = useStyles({ size, radius });
  const url = `url("${mapIcons[mapIconKey(category)]}")`;
  return (
    <span className={cx(classes.tile, status !== 'online' && classes.idle, className)}>
      <span className={classes.glyph} style={{ maskImage: url, WebkitMaskImage: url }} />
    </span>
  );
};

export default DeviceTile;
