import { useMemo } from 'react';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from '../settings/components/SettingsMenu';
import SettingsCard from '../settings/components/SettingsCard';
import { useSettingsSections } from '../settings/components/settingsSections';
import ExpiryTiles from './components/ExpiryTiles';
import FleetSyncCard from './components/FleetSyncCard';

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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: theme.spacing(1.5),
  },
}));

const fleetItems = [
  'expiries',
  'fleetAlerts',
  'devices',
  'drivers',
  'maintenance',
  'fleetDocuments',
];

// Top-level "Fleet" destination: vehicles, drivers, maintenance and validity in one place.
const FleetHubPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const sections = useSettingsSections();

  const items = useMemo(() => {
    const fleet = sections.find((section) => section.id === 'fleet');
    return fleetItems.map((id) => fleet?.items.find((item) => item.id === id)).filter(Boolean);
  }, [sections]);

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle']}
      description={t('fleetHubDescription')}
    >
      <div className={classes.root}>
        <ExpiryTiles />
        <div className={classes.grid}>
          {items.map((item) => (
            <SettingsCard
              key={item.id}
              icon={item.icon}
              title={t(item.titleKey)}
              description={t(item.descriptionKey)}
              to={item.path}
            />
          ))}
        </div>
        <FleetSyncCard />
      </div>
    </PageLayout>
  );
};

export default FleetHubPage;
