import { Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from '../settings/components/SettingsMenu';
import SettingsCard from '../settings/components/SettingsCard';
import { useFleetSections } from '../settings/components/settingsSections';
import ExpiryTiles from './components/ExpiryTiles';
import FleetSyncCard from './components/FleetSyncCard';
import FleetKpis from './components/FleetKpis';
import FleetSetupCard from './components/FleetSetupCard';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(1, 3, 4),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    maxWidth: 1180,
    width: '100%',
    marginInline: 'auto',
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

// Top-level "Fleet" destination: the fleet menu's groups as cards (ADM-02).
const FleetHubPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const sections = useFleetSections();

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle']}
      description={t('fleetHubDescription')}
    >
      <div className={classes.root}>
        <FleetSetupCard />
        <ExpiryTiles />
        <FleetKpis />
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`fleet-hub-${section.id}`}>
            <Typography
              variant="subtitle2"
              color="textSecondary"
              component="h2"
              id={`fleet-hub-${section.id}`}
              className={classes.heading}
            >
              {t(section.titleKey)}
            </Typography>
            <div className={classes.grid}>
              {section.items.map((item) => (
                <SettingsCard
                  key={item.id}
                  icon={item.icon}
                  title={t(item.titleKey)}
                  description={t(item.descriptionKey)}
                  to={item.path}
                />
              ))}
            </div>
          </section>
        ))}
        <FleetSyncCard />
      </div>
    </PageLayout>
  );
};

export default FleetHubPage;
