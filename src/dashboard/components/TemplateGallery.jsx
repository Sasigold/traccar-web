import { ButtonBase, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { TEMPLATES, TEMPLATE_KEYS } from '../model/templates';

const useStyles = makeStyles()((theme) => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: theme.spacing(1.5),
    width: '100%',
    maxWidth: 760,
    marginTop: theme.spacing(1),
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    textAlign: 'start',
    borderRadius: theme.tokens.radius.lg,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.background.paper,
    '&:hover, &.Mui-focusVisible': {
      borderColor: theme.palette.primary.main,
    },
  },
  thumb: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    padding: 6,
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.sunken,
  },
  row: {
    display: 'flex',
    gap: 3,
  },
  box: {
    borderRadius: 3,
    backgroundColor: theme.palette.surface.tint,
    border: `1px solid ${theme.palette.surface.border}`,
  },
}));

// A small drawing of a template's rows (heights and widths), so the choice is seen, not read.
const Thumb = ({ rows }) => {
  const { classes } = useStyles();
  return (
    <div className={classes.thumb} aria-hidden>
      {rows.map(([height, ...cells], index) => (
        <div key={index} className={classes.row} style={{ height: height * 4 }}>
          {cells.map(([width], cellIndex) => (
            <div key={cellIndex} className={classes.box} style={{ flex: width }} />
          ))}
        </div>
      ))}
    </div>
  );
};

// REP-19: the templates as a gallery (also from the empty state), not hidden in the "+" menu.
const TemplateGallery = ({ available = () => true, onPick }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  return (
    <div className={classes.grid} role="list" aria-label={t('dashboardTemplates')}>
      {TEMPLATE_KEYS.filter(available).map((key) => (
        <div key={key} role="listitem" style={{ display: 'flex' }}>
          <ButtonBase className={classes.card} sx={{ flex: 1 }} onClick={() => onPick(key)}>
            <Thumb rows={TEMPLATES[key].rows} />
            <Typography variant="subtitle2" component="span">
              {t(TEMPLATES[key].nameKey)}
            </Typography>
            <Typography variant="caption" color="textSecondary" component="span">
              {t(`${TEMPLATES[key].nameKey}Desc`)}
            </Typography>
          </ButtonBase>
        </div>
      ))}
    </div>
  );
};

export default TemplateGallery;
