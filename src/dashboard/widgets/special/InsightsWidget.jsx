import { Link as RouterLink } from 'react-router-dom';
import { Link, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { useInsightText, useMorningFindings } from '../../../main/morningFindings';
import { WidgetState } from '../WidgetFrame';

const useStyles = makeStyles()((theme) => ({
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    overflowY: 'auto',
    height: '100%',
  },
  item: {
    display: 'flex',
    gap: theme.spacing(1),
    '& > svg': { color: theme.palette.primary.main, marginTop: 2 },
  },
  title: {
    fontWeight: 600,
  },
}));

// AI-02: the morning findings on the dashboard: the same up to four findings as beside the map,
// each with why and a link to the evidence.
const InsightsWidget = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const findings = useMorningFindings({ delay: 300 });
  const text = useInsightText();

  if (findings == null) return <WidgetState state="loading" />;
  if (!findings.length) {
    return <WidgetState state="notice" notice={t('insightsNone')} />;
  }
  return (
    <ul className={classes.list}>
      {findings.map((finding) => (
        <li key={finding.id} className={classes.item}>
          <LightbulbRoundedIcon fontSize="small" />
          <div>
            <Typography variant="body2" className={classes.title}>
              {text(finding, 'Title')}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {text(finding, 'Why')}
            </Typography>
            <Link component={RouterLink} to={finding.link} variant="body2">
              {t('insightsEvidence')}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default InsightsWidget;
