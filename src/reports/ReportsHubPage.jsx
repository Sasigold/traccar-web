import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Chip, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import usePersistedState from '../common/util/usePersistedState';
import { savedReportLink } from './common/savedReports';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsCard from '../settings/components/SettingsCard';
import ReportsMenu from './components/ReportsMenu';
import { buildReportLink, useReportsSections } from './components/reportsSections';
import { recentReportIds } from '../common/util/recentReports';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(1, 3, 4),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    maxWidth: 1180,
    width: '100%',
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(2, 2, 4),
    },
  },
  heading: {
    marginBottom: theme.spacing(1),
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: theme.spacing(1.5),
  },
}));

// /reports (REP-02): the reports by the question they answer, with the ones opened last on top.
// The selected vehicle comes along into the report.
const ReportsHubPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const sections = useReportsSections();
  const selectedId = useSelector((state) => state.devices.selectedId);
  const search = selectedId != null ? `?deviceId=${selectedId}` : '';

  const [savedReports, setSavedReports] = usePersistedState('savedReports', []);

  const recent = useMemo(() => {
    const items = sections.flatMap((section) => section.items);
    return recentReportIds()
      .map((id) => items.find((item) => item.id === id))
      .filter(Boolean);
  }, [sections]);

  const card = (item) => (
    <SettingsCard
      key={item.id}
      icon={item.icon}
      title={t(item.titleKey)}
      description={t(item.descriptionKey)}
      to={item.carry ? buildReportLink(item.path, search) : item.path}
    />
  );

  const group = (id, titleKey, items) => (
    <section key={id} aria-labelledby={`reports-hub-${id}`}>
      <Typography
        variant="subtitle2"
        color="textSecondary"
        component="h2"
        id={`reports-hub-${id}`}
        className={classes.heading}
      >
        {t(titleKey)}
      </Typography>
      <div className={classes.grid}>{items.map(card)}</div>
    </section>
  );

  return (
    <PageLayout
      menu={<ReportsMenu />}
      breadcrumbs={['reportTitle']}
      description={t('reportsHubDescription')}
    >
      <div className={classes.root}>
        {/* REP-09: views saved from a report open it on the current dates of their period. */}
        {savedReports.length > 0 && (
          <section aria-labelledby="reports-hub-saved">
            <Typography
              variant="subtitle2"
              color="textSecondary"
              component="h2"
              id="reports-hub-saved"
              className={classes.heading}
            >
              {t('reportSavedViews')}
            </Typography>
            <Stack direction="row" component="ul" sx={{ m: 0, p: 0, gap: 1, flexWrap: 'wrap' }}>
              {savedReports.map((view) => (
                <li key={view.id} style={{ listStyle: 'none' }}>
                  <Chip
                    icon={<BookmarkRoundedIcon />}
                    label={view.name}
                    component={RouterLink}
                    to={savedReportLink(view, new Date())}
                    clickable
                    variant="outlined"
                    onDelete={(event) => {
                      event.preventDefault();
                      setSavedReports(savedReports.filter((item) => item.id !== view.id));
                    }}
                  />
                </li>
              ))}
            </Stack>
          </section>
        )}
        {recent.length > 0 && group('recent', 'reportsRecent', recent)}
        {sections.map((section) => group(section.id, section.titleKey, section.items))}
      </div>
    </PageLayout>
  );
};

export default ReportsHubPage;
