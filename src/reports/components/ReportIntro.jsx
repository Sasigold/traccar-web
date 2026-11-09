import { Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useReportsSectionItems } from './reportsSections';

const useStyles = makeStyles()((theme) => ({
  root: {
    flexBasis: '100%',
    color: theme.palette.text.secondary,
    '@media print': {
      display: 'none',
    },
  },
  // Above a table (a flex column), the intro keeps its own height: the 100% basis is for the
  // filter's wrapping row, where it means a full line.
  padded: {
    flex: '0 0 auto',
    padding: theme.spacing(1.5, 3),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(1.5, 2),
    },
  },
  hint: {
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
}));

// One or two plain-language lines: what the current report shows and what to do next.
const ReportIntro = ({ hint, padded, className }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const location = useLocation();
  const item = useReportsSectionItems().find((it) => it.match(location.pathname));

  if (!item?.descriptionKey && !hint) {
    return null;
  }
  return (
    <Typography variant="body2" className={cx(classes.root, padded && classes.padded, className)}>
      {item?.descriptionKey && t(item.descriptionKey)}
      {hint && (
        <>
          {item?.descriptionKey && ' '}
          <span className={classes.hint}>{hint}</span>
        </>
      )}
    </Typography>
  );
};

export default ReportIntro;
