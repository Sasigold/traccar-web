import { Tab, Tabs } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useFleetSections } from '../../settings/components/settingsSections';

const useStyles = makeStyles()((theme) => ({
  tabs: {
    margin: theme.spacing(0, 3, 1),
    minHeight: 40,
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 2, 1),
    },
    '& .MuiTab-root': {
      minHeight: 40,
    },
  },
}));

// Validity dates, documents and validity alerts are one subject on three pages (ADM-02): the
// same tabs on each, so they read as one screen.
const ValidityTabs = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const location = useLocation();
  const group = useFleetSections().find((section) => section.id === 'fleetValidity');
  const items = group?.items || [];
  const current = items.find((item) => item.match(location.pathname));

  if (items.length < 2) {
    return null;
  }

  return (
    <Tabs
      value={current?.id || false}
      className={classes.tabs}
      variant="scrollable"
      allowScrollButtonsMobile
      aria-label={t('fleetGroupValidity')}
    >
      {items.map((item) => (
        <Tab
          key={item.id}
          value={item.id}
          label={t(item.titleKey)}
          component={RouterLink}
          to={item.path}
        />
      ))}
    </Tabs>
  );
};

export default ValidityTabs;
