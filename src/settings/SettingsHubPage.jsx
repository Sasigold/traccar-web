import { useMemo, useState } from 'react';
import { InputAdornment, TextField, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import PageLayout from '../common/components/PageLayout';
import EmptyState from '../common/components/table/EmptyState';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsCard from './components/SettingsCard';
import { useSettingsSections } from './components/settingsSections';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(1, 3, 4),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3.5),
    maxWidth: 1180,
    width: '100%',
    marginInline: 'auto',
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(2, 2, 4),
      gap: theme.spacing(3),
    },
  },
  search: {
    maxWidth: 520,
    '& .MuiOutlinedInput-root': {
      height: 48,
      borderRadius: theme.tokens.radius.lg,
      fontSize: '1rem',
    },
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  groupTitle: {
    color: theme.palette.text.secondary,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: theme.spacing(1.5),
  },
}));

const SettingsHubPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const sections = useSettingsSections();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return sections;
    }
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          [t(item.titleKey), t(item.descriptionKey), t(section.titleKey)]
            .filter(Boolean)
            .some((text) => text.toLowerCase().includes(needle)),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, query, t]);

  return (
    <PageLayout breadcrumbs={['settingsTitle']} description={t('settingsHubDescription')}>
      <div className={classes.root}>
        <TextField
          className={classes.search}
          placeholder={t('settingsSearchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus={desktop}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon />
                </InputAdornment>
              ),
            },
          }}
        />
        {filtered.map((section) => (
          <section key={section.id} className={classes.group}>
            <Typography variant="overline" className={classes.groupTitle}>
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
                  href={item.href}
                />
              ))}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <EmptyState icon={<SearchOffRoundedIcon />} title={t('shellNoResults')} />
        )}
      </div>
    </PageLayout>
  );
};

export default SettingsHubPage;
